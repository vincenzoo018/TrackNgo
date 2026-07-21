using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Mayor.Controllers
{
    [Area("Mayor")]
    [RequireLogin(SessionHelper.ROLE_MAYOR)]
    public class SignatureController : Controller
    {
        private readonly TrackNgoDbContext _context;
        private readonly SmsService _sms;

        public SignatureController(TrackNgoDbContext context, SmsService sms)
        {
            _context = context;
            _sms     = sms;
        }

        // GET: Documents awaiting Mayor's approval (Status 2)
        public IActionResult Index()
        {
            ViewData["Title"]   = "Executive Signatures";
            ViewBag.CurrentPage = "Signature";
            var docs = _context.Documents
                .Include(d => d.DigitalSignatures)
                .Include(d => d.AuditTrailEntries).ThenInclude(a => a.User)
                .Where(d => d.CurrentStatus == 2)
                .OrderBy(d => d.DateFiled)
                .ToList();
            return View(docs);
        }

        // POST: Approve (digitally sign)
        [HttpPost]
        public IActionResult Approve(int id, string? remarks)
        {
            var doc    = _context.Documents.Find(id);
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            var user   = _context.Users.Find(userId);
            if (doc == null || user == null) return NotFound();

            // Advance workflow
            doc.CurrentStatus    = 3; // Completed
            doc.CurrentOfficeName = "Mayor's Office — Completed";
            doc.CurrentStepIndex += 1;
            doc.DateCompleted    = DateTime.Now;
            doc.LastUpdated      = DateTime.Now;

            // SHA256 digital signature hash
            using var sha256 = SHA256.Create();
            var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes($"{doc.TrackingNumber}-{userId}-{DateTime.Now.Ticks}"));
            var hash      = Convert.ToHexString(hashBytes).ToLower();

            _context.DigitalSignatures.Add(new DigitalSignature
            {
                DocumentId      = doc.Id,
                SignedByUserId  = userId,
                SignatureHash   = hash,
                SignatureImagePath = "e-signature",
                ActionType      = "Approved",
                Remarks         = remarks,
                SignedAt        = DateTime.Now,
                IsVerified      = true
            });

            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                DocumentId = doc.Id,
                UserId     = userId,
                Action     = "Approved",
                Timestamp  = DateTime.Now,
                Ipaddress  = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details    = $"Document digitally signed and approved by {user.FullName}. Hash: {hash[..16]}..."
            });

            _context.SaveChanges();

            // Notify client
            if (!string.IsNullOrEmpty(doc.ContactNumber))
                _sms.Send(doc.Id, doc.ContactNumber, doc.SubmittedBy,
                    $"TrackNGo Mati: Your document '{doc.Title}' (Ref# {doc.TrackingNumber}) has been APPROVED by the Mayor. You may claim your document at the Records Office.",
                    "Approved");

            TempData["Success"] = $"Document {doc.TrackingNumber} approved and digitally signed.";
            return RedirectToAction("Index");
        }

        // POST: Return document
        [HttpPost]
        public IActionResult Return(int id, string remarks)
        {
            var doc    = _context.Documents.Find(id);
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            var user   = _context.Users.Find(userId);
            if (doc == null || user == null) return NotFound();

            doc.CurrentStatus = 4; // Returned
            doc.LastUpdated   = DateTime.Now;

            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                DocumentId = doc.Id,
                UserId     = userId,
                Action     = "Returned",
                Timestamp  = DateTime.Now,
                Ipaddress  = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details    = $"Returned by {user.FullName}: {remarks}"
            });
            _context.SaveChanges();

            if (!string.IsNullOrEmpty(doc.ContactNumber))
                _sms.Send(doc.Id, doc.ContactNumber, doc.SubmittedBy,
                    $"TrackNGo Mati: Your document '{doc.Title}' (Ref# {doc.TrackingNumber}) has been RETURNED for revision. Remarks: {remarks}",
                    "Returned");

            TempData["Info"] = $"Document {doc.TrackingNumber} returned with remarks.";
            return RedirectToAction("Index");
        }
    }
}
