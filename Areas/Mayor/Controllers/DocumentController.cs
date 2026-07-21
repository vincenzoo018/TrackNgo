using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;
using System.Linq;
using System;

namespace TrackNGoMati.Areas.Mayor.Controllers
{
    [Area("Mayor")]
    [RequireLogin(SessionHelper.ROLE_MAYOR)]
    public class DocumentController : Controller
    {
        private readonly TrackNgoDbContext _context;
        private readonly SmsService _sms;

        public DocumentController(TrackNgoDbContext context, SmsService sms)
        {
            _context = context;
            _sms = sms;
        }

        public IActionResult Index(string? search = null)
        {
            ViewData["Title"] = "Executive Approvals";
            ViewBag.CurrentPage = "Document";
            
            // FSM Step 4: Mayor
            var query = _context.Documents.Where(d => d.CurrentStepIndex == 4).AsQueryable();
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(d => d.TrackingNumber.Contains(search) || d.Title.Contains(search));
            }

            return View(query.OrderByDescending(d => d.LastUpdated).ToList());
        }

        public IActionResult Details(string? id)
        {
            ViewData["Title"] = "Document Details";
            ViewBag.CurrentPage = "Document";
            var doc = _context.Documents
                .Include(d => d.AuditTrailEntries).ThenInclude(a => a.User)
                .Include(d => d.DocumentComments).ThenInclude(c => c.User)
                .Include(d => d.WorkflowTransitions)
                .FirstOrDefault(d => d.TrackingNumber == id);
                
            if (doc == null) return NotFound();
            return View(doc);
        }
        
        [HttpPost]
        public IActionResult Approve(string trackingNumber, string signatureData)
        {
            var doc = _context.Documents.FirstOrDefault(d => d.TrackingNumber == trackingNumber);
            if (doc == null) return Json(new { success = false, message = "Document not found" });

            if (doc.CurrentStepIndex != 4)
                return Json(new { success = false, message = "Document is not in the Mayor stage." });

            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            
            _context.DigitalSignatures.Add(new DigitalSignature
            {
                DocumentId = doc.Id,
                SignedByUserId = userId,
                SignatureImagePath = signatureData, // Storing base64 string directly
                SignatureHash = "sha256:generated-hash-placeholder", // Real hash logic here
                ActionType = "Approved",
                IsVerified = true,
                SignedAt = DateTime.Now
            });

            // FSM Transition to Completed/Receiving for release (Step 5)
            doc.CurrentStepIndex = 5;
            doc.LastUpdated = DateTime.Now;

            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                DocumentId = doc.Id,
                UserId = userId,
                Action = "Approved",
                Details = "Mayor approved and signed the document. It is now ready for release.",
                Timestamp = DateTime.Now,
                Ipaddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
            });

            _context.SaveChanges();
            
            if (!string.IsNullOrEmpty(doc.ContactNumber))
                _sms.Send(doc.Id, doc.ContactNumber, doc.SubmittedBy, $"TrackNGo Mati: Great news! Your document ({trackingNumber}) was approved by the Mayor. You may now claim it.", "Approved");

            return Json(new { success = true, redirectUrl = "/Mayor/Document" });
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
    
        [HttpPost]
        public IActionResult Transition([FromBody] TransitionRequest req)
        {
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            // WorkflowEngine dependency is injected
            var workflowEngine = new TrackNGoMati.Services.WorkflowEngine(_context, null);
            bool success = workflowEngine.TransitionDocument(req.TrackingNumber, userId, req.Action, req.Remarks, req.TargetUserId, req.SignatureData);
            if (success)
            {
                return Json(new { success = true, message = $"Document successfully processed ({req.Action})." });
            }
            return Json(new { success = false, message = "Transition failed. You may not have permission or the document state is invalid." });
        }
        
        public class TransitionRequest {
            public string TrackingNumber { get; set; }
            public string Action { get; set; }
            public string Remarks { get; set; }
            public int? TargetUserId { get; set; }
            public string SignatureData { get; set; }
        }
}
}
