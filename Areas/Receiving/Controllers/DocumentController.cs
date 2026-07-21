using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Receiving.Controllers
{
    [Area("Receiving")]
    [RequireLogin(SessionHelper.ROLE_RECORDS)]
    public class DocumentController : Controller
    {
        private readonly TrackNgoDbContext _context;
        private readonly OcrService _ocr;
        private readonly SmsService _sms;
        private readonly IWebHostEnvironment _env;

        public DocumentController(TrackNgoDbContext context, OcrService ocr, SmsService sms, IWebHostEnvironment env)
        {
            _context = context;
            _ocr     = ocr;
            _sms     = sms;
            _env     = env;
        }

        // GET: Document list
        public IActionResult Index(string? search, int? statusFilter)
        {
            ViewData["Title"]    = "Document Registration";
            ViewBag.CurrentPage  = "Document";
            ViewBag.DocTypes     = _context.DocumentTypeConfigs.OrderBy(t => t.TypeName).ToList();
            ViewBag.Departments  = _context.Departments.OrderBy(d => d.DepartmentName).ToList();
            ViewBag.Templates    = _context.DocumentTemplates.OrderBy(t => t.Title).ToList();

            var query = _context.Documents.AsQueryable();
            if (!string.IsNullOrEmpty(search))
                query = query.Where(d => d.TrackingNumber.Contains(search) || d.Title.Contains(search));
            if (statusFilter != null)
                query = query.Where(d => d.CurrentStatus == statusFilter);

            return View(query.OrderByDescending(d => d.DateFiled).ToList());
        }

        // POST: Register new document
        [HttpPost]
        public IActionResult Register(string Title, int TypeId, int DepartmentId,
                                      string SubmittedBy, string ContactNumber, string? EmailAddress,
                                      IFormFile? AttachedDocument, bool IsUrgent = false, string? UrgencyJustification = null)
        {
            var dept        = _context.Departments.Find(DepartmentId);
            var type        = _context.DocumentTypeConfigs.Find(TypeId);
            var clerkId     = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            var clerk       = _context.Users.Find(clerkId);

            if (dept == null || type == null || clerk == null)
            {
                TempData["Error"] = "Invalid department or document type.";
                return RedirectToAction("Index");
            }

            var newId          = _context.Documents.Count() + 1;
            var trackingNumber = $"TNG-{DateTime.Now.Year}-{newId:D4}";

            // Handle file upload
            string? attachPath = null;
            if (AttachedDocument != null && AttachedDocument.Length > 0)
            {
                var uploadsDir = Path.Combine(_env.WebRootPath, "uploads", "documents");
                Directory.CreateDirectory(uploadsDir);
                var fileName  = $"{trackingNumber}_{Path.GetFileName(AttachedDocument.FileName)}";
                var filePath  = Path.Combine(uploadsDir, fileName);
                using (var fs = new FileStream(filePath, FileMode.Create))
                    AttachedDocument.CopyTo(fs);
                attachPath = $"/uploads/documents/{fileName}";
            }

            var doc = new Document
            {
                TrackingNumber        = trackingNumber,
                Title                 = Title,
                DocumentType          = type.TypeName,
                TypeId                = TypeId,
                OriginatingDepartment = dept.DepartmentName,
                DepartmentId          = DepartmentId,
                SubmittedBy           = SubmittedBy,
                ContactNumber         = ContactNumber,
                EmailAddress          = EmailAddress,
                CurrentStatus         = 1,
                CurrentOfficeName     = dept.DepartmentName,
                CurrentStepIndex      = 1,
                TotalSteps            = 5,
                AttachmentPath        = attachPath,
                DateFiled             = DateTime.Now,
                LastUpdated           = DateTime.Now,
                ArtaprocessingDays    = type.DefaultProcessingDays,
                IsEscalated           = false,
                IsLocked              = false,
                CreatedByUserId       = clerkId
            };
            _context.Documents.Add(doc);

            // QR Code record
            var qrUrl = $"/Track/{trackingNumber}";
            _context.QrcodeRecords.Add(new QrcodeRecord
            {
                Document       = doc,
                TrackingNumber = trackingNumber,
                TrackingUrl    = qrUrl,
                QrcodeImagePath = $"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={trackingNumber}",
                GeneratedAt    = DateTime.Now
            });

            // Audit trail
            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                Document  = doc,
                UserId    = clerkId,
                Action    = "Registered",
                Timestamp = DateTime.Now,
                Ipaddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details   = $"Document '{Title}' registered with tracking number {trackingNumber}."
            });

            _context.SaveChanges();

            // SMS to client
            if (!string.IsNullOrEmpty(ContactNumber))
                _sms.Send(doc.Id, ContactNumber, SubmittedBy,
                    $"TrackNGo Mati: Your document '{Title}' was received. Tracking No: {trackingNumber}. Use this to track your document status.",
                    "Registered");

            return RedirectToAction("RoutingSlip", new { id = trackingNumber });
        }

        // GET: Routing Slip
        public IActionResult RoutingSlip(string id)
        {
            ViewData["Title"]   = "Routing Slip";
            ViewBag.CurrentPage = "RoutingSlip";
            var doc = _context.Documents.FirstOrDefault(d => d.TrackingNumber == id);
            if (doc == null) return NotFound();
            return View(doc);
        }

        // GET: Document details
        public IActionResult Details(string id)
        {
            ViewData["Title"]   = "Document Details";
            ViewBag.CurrentPage = "Document";
            var doc = _context.Documents
                .Include(d => d.AuditTrailEntries).ThenInclude(a => a.User)
                .Include(d => d.DocumentComments).ThenInclude(c => c.User)
                .Include(d => d.WorkflowTransitions)
                .FirstOrDefault(d => d.TrackingNumber == id);
            if (doc == null) return NotFound();
            return View(doc);
        }

        // POST: OCR extraction (returns JSON for AJAX)
        [HttpPost]
        public IActionResult OcrExtract(IFormFile imageFile)
        {
            try
            {
                var rawText = _ocr.ExtractTextFromImage(imageFile);
                var fields  = _ocr.ParseDocumentFields(rawText);
                return Json(new { success = true, rawText, fields });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }
        [HttpPost]
        public IActionResult Forward(string trackingNumber, string signatureData)
        {
            var doc = _context.Documents.FirstOrDefault(d => d.TrackingNumber == trackingNumber);
            if (doc == null) return Json(new { success = false, message = "Document not found" });

            if (doc.CurrentStepIndex != 1)
                return Json(new { success = false, message = "Document is already forwarded." });

            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            
            // FSM Transition to Dept Head (Step 2)
            doc.CurrentStepIndex = 2;
            doc.LastUpdated = DateTime.Now;

            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                DocumentId = doc.Id,
                UserId = userId,
                Action = "Forwarded to Dept Head",
                Details = "Receiving clerk forwarded the document to the Department Head for review.",
                Timestamp = DateTime.Now,
                Ipaddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
            });

            _context.SaveChanges();
            
            if (!string.IsNullOrEmpty(doc.ContactNumber))
                _sms.Send(doc.Id, doc.ContactNumber, doc.SubmittedBy, $"TrackNGo Mati: Your document ({trackingNumber}) was verified and forwarded to the Department Head.", "Forwarded");

            return Json(new { success = true, redirectUrl = "/Receiving/Document" });
        }
        [HttpPost]
        public IActionResult AddAnchoredComment([FromBody] AnchoredCommentDto request)
        {
            var doc = _context.Documents.FirstOrDefault(d => d.TrackingNumber == request.TrackingNumber);
            if (doc == null) return Json(new { success = false, message = "Document not found" });

            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;

            var comment = new DocumentComment
            {
                DocumentId = doc.Id,
                UserId = userId,
                Content = request.Content,
                AnchorLocation = request.AnchorLocation,
                WorkflowState = request.WorkflowState,
                RemarkType = "Anchored",
                IsInternal = false,
                PostedAt = DateTime.Now,
                Resolved = false
            };

            _context.DocumentComments.Add(comment);
            _context.SaveChanges();

            return Json(new { success = true, commentId = comment.Id, timestamp = comment.PostedAt.ToString("MMM dd, yyyy \\- h:mm tt") });
        }

        [HttpPost]
        public IActionResult ResolveComment([FromBody] ResolveCommentDto request)
        {
            var comment = _context.DocumentComments.Find(request.CommentId);
            if (comment == null) return Json(new { success = false, message = "Comment not found" });

            comment.Resolved = true;
            _context.SaveChanges();

            return Json(new { success = true });
        }

        public class AnchoredCommentDto {
            public string TrackingNumber { get; set; } = "";
            public string Content { get; set; } = "";
            public string? AnchorLocation { get; set; }
            public string? WorkflowState { get; set; }
        }

        public class ResolveCommentDto {
            public int CommentId { get; set; }
        }
    }
}
