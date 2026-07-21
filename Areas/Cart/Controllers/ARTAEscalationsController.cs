using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Cart.Controllers
{
    [Area("Cart")]
    [RequireLogin(SessionHelper.ROLE_CART)]
    public class ARTAEscalationsController : Controller
    {
        private readonly TrackNgoDbContext _context;
        private readonly SmsService _sms;

        public ARTAEscalationsController(TrackNgoDbContext context, SmsService sms)
        {
            _context = context;
            _sms     = sms;
        }

        // GET: All overdue/escalated documents
        public IActionResult Index()
        {
            ViewData["Title"]   = "ARTA Escalations";
            ViewBag.CurrentPage = "ARTAEscalations";

            var now  = DateTime.Now;
            var docs = _context.Documents
                .Include(d => d.EscalationLogs)
                .ToList()
                .Where(d => d.CurrentStatus != 3) // not completed
                .Select(d => new
                {
                    Document    = d,
                    ElapsedDays = (int)(now - d.DateFiled).TotalDays,
                    IsOverdue   = (int)(now - d.DateFiled).TotalDays > d.ArtaprocessingDays
                })
                .OrderByDescending(x => x.IsOverdue)
                .ThenByDescending(x => x.ElapsedDays)
                .ToList();

            ViewBag.EscalatedDocs = docs;
            return View();
        }

        // POST: Manually escalate a document
        [HttpPost]
        public IActionResult Escalate(int documentId)
        {
            var doc    = _context.Documents.Find(documentId);
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            var user   = _context.Users.Find(userId);
            if (doc == null || user == null) return NotFound();

            doc.IsEscalated = true;
            doc.IsLocked    = true;
            doc.LastUpdated = DateTime.Now;

            var elapsed = (int)(DateTime.Now - doc.DateFiled).TotalDays;
            _context.EscalationLogs.Add(new EscalationLog
            {
                DocumentId       = documentId,
                EscalationLevel  = "Manual",
                EscalationReason = $"Manually escalated by CART Officer {user.FullName}. Elapsed: {elapsed} days.",
                ArtaperiodDays   = doc.ArtaprocessingDays,
                ElapsedDays      = elapsed,
                Artathreshold    = doc.ArtaprocessingDays,
                ViolatingOffice  = doc.CurrentOfficeName,
                EscalatedAt      = DateTime.Now,
                IsResolved       = false,
                NotifiedUserId   = userId
            });

            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                DocumentId = documentId,
                UserId     = userId,
                Action     = "Escalated",
                Timestamp  = DateTime.Now,
                Ipaddress  = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details    = $"Manual ARTA escalation by {user.FullName}. Elapsed: {elapsed} days."
            });
            _context.SaveChanges();

            // SMS to the client
            _sms.NotifyEscalation(doc, user.MobileNumber ?? "09000000000", user.FullName);

            TempData["Success"] = $"Document {doc.TrackingNumber} has been escalated.";
            return RedirectToAction("Index");
        }

        // POST: Resolve escalation
        [HttpPost]
        public IActionResult Resolve(int escalationId, string resolutionNotes)
        {
            var log    = _context.EscalationLogs.Find(escalationId);
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            if (log == null) return NotFound();

            log.IsResolved       = true;
            log.ResolvedAt       = DateTime.Now;
            log.ResolutionNotes  = resolutionNotes;
            log.ResolvedByUserId = userId;

            // Unlock the document
            var doc = _context.Documents.Find(log.DocumentId);
            if (doc != null)
            {
                doc.IsEscalated = false;
                doc.IsLocked    = false;
                doc.LastUpdated = DateTime.Now;
            }

            _context.SaveChanges();
            TempData["Success"] = "Escalation resolved.";
            return RedirectToAction("Index");
        }
    }
}
