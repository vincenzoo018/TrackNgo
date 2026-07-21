using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.DepartmentHead.Controllers
{
    [Area("DepartmentHead")]
    [RequireLogin(SessionHelper.ROLE_DEPT)]
    public class WorkflowController : Controller
    {
        private readonly TrackNgoDbContext _context;
        private readonly SmsService _sms;

        public WorkflowController(TrackNgoDbContext context, SmsService sms)
        {
            _context = context;
            _sms     = sms;
        }

        // GET: Documents pending department review (Status 1)
        public IActionResult Index(string? search)
        {
            ViewData["Title"]   = "FSM Workflow Routing";
            ViewBag.CurrentPage = "Workflow";

            var userId    = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID);
            var user      = userId != null ? _context.Users.Find(userId) : null;
            var deptId    = user?.DepartmentId;

            // Dept head only sees documents assigned to their department
            var query = _context.Documents
                .Include(d => d.AuditTrailEntries)
                .Where(d => d.CurrentStatus == 1);

            if (deptId != null)
                query = query.Where(d => d.DepartmentId == deptId);

            if (!string.IsNullOrEmpty(search))
                query = query.Where(d => d.TrackingNumber.Contains(search) || d.Title.Contains(search));

            return View(query.OrderBy(d => d.DateFiled).ToList());
        }

        // POST: Endorse or Return a document
        [HttpPost]
        public IActionResult Endorse(int id, string actionType, string? remarks)
        {
            var doc    = _context.Documents.Find(id);
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            var user   = _context.Users.Find(userId);
            if (doc == null || user == null) return NotFound();

            string notifMsg;
            string smsEvent;

            if (actionType == "Endorse")
            {
                doc.CurrentStatus     = 2; // Forwarded to Mayor
                doc.CurrentOfficeName = "Office of the Mayor";
                doc.CurrentStepIndex += 1;
                doc.LastUpdated       = DateTime.Now;
                notifMsg = $"Document '{doc.Title}' (Ref# {doc.TrackingNumber}) has been endorsed to the Mayor's Office by {user.FullName}.";
                smsEvent = "Endorsed";
            }
            else if (actionType == "Return")
            {
                doc.CurrentStatus = 4; // Returned
                doc.LastUpdated   = DateTime.Now;
                notifMsg = $"Document '{doc.Title}' (Ref# {doc.TrackingNumber}) has been returned for revision. Remarks: {remarks}";
                smsEvent = "Returned";
            }
            else
            {
                TempData["Error"] = "Invalid action.";
                return RedirectToAction("Index");
            }

            // Workflow Transition
            _context.WorkflowTransitions.Add(new WorkflowTransition
            {
                DocumentId       = doc.Id,
                PerformedByUserId = userId,
                ActionTaken      = actionType,
                FromOffice       = user.Department,
                ToOffice         = doc.CurrentOfficeName,
                Remarks          = remarks,
                TransitionDate   = DateTime.Now
            });

            _context.AuditTrailEntries.Add(new AuditTrailEntry
            {
                DocumentId = doc.Id,
                UserId     = userId,
                Action     = actionType,
                Timestamp  = DateTime.Now,
                Ipaddress  = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details    = remarks ?? $"Document {actionType}d by {user.FullName}"
            });

            _context.SaveChanges();

            // SMS client notification
            if (!string.IsNullOrEmpty(doc.ContactNumber))
                _sms.Send(doc.Id, doc.ContactNumber, doc.SubmittedBy, notifMsg, smsEvent);

            TempData["Success"] = $"Document {actionType}d successfully.";
            return RedirectToAction("Index");
        }

        // GET: Document details
        public IActionResult Details(string id)
        {
            ViewData["Title"]   = "Document Details";
            ViewBag.CurrentPage = "Workflow";
            var doc = _context.Documents
                .Include(d => d.AuditTrailEntries).ThenInclude(a => a.User)
                .Include(d => d.WorkflowTransitions).ThenInclude(t => t.PerformedByUser)
                .FirstOrDefault(d => d.TrackingNumber == id);
            if (doc == null) return NotFound();
            return View(doc);
        }
    }
}
