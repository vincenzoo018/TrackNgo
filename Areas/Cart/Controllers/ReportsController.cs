using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Cart.Controllers
{
    [Area("Cart")]
    [RequireLogin(SessionHelper.ROLE_CART)]
    public class ReportsController : Controller
    {
        private readonly TrackNgoDbContext _context;
        private readonly ExportService _export;

        public ReportsController(TrackNgoDbContext context, ExportService export)
        {
            _context = context;
            _export  = export;
        }

        public IActionResult Index()
        {
            ViewData["Title"]   = "Reports Dashboard";
            ViewBag.CurrentPage = "Reports";
            return View();
        }

        // POST: Verify export password and export CSV
        [HttpPost]
        public IActionResult ExportCsv(string exportType, string exportPassword)
        {
            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID) ?? 0;
            var user   = _context.Users.Find(userId);
            if (user == null) return Unauthorized();

            // Verify export password
            var pwHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(exportPassword))).ToLower();
            if (user.ExportPasswordHash != pwHash)
            {
                TempData["ExportError"] = "Incorrect export password. Access denied.";
                return RedirectToAction("Index");
            }

            // Log the export attempt
            var exportLog = new ExportAuditLog
            {
                UserId     = userId,
                ExportType = "CSV",
                ExportScope = exportType,
                ExportedAt = DateTime.Now,
                Ipaddress  = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
            };
            _context.ExportAuditLogs.Add(exportLog);
            _context.SaveChanges();

            byte[] csvBytes;
            string fileName;

            switch (exportType)
            {
                case "documents":
                    var docs = _context.Documents.Include(d => d.Department).ToList();
                    var rows = docs.Select(d => new[]
                    {
                        d.TrackingNumber, d.Title, d.DocumentType,
                        d.OriginatingDepartment, d.SubmittedBy,
                        d.DateFiled.ToString("yyyy-MM-dd"),
                        StatusLabel(d.CurrentStatus), d.CurrentOfficeName,
                        d.ArtaprocessingDays.ToString(), d.IsEscalated ? "Yes" : "No"
                    });
                    csvBytes = _export.GenerateCsv(rows,
                        ["Tracking No", "Title", "Type", "Department", "Submitted By",
                         "Date Filed", "Status", "Current Office", "ARTA Days", "Escalated"]);
                    fileName = $"documents_{DateTime.Now:yyyyMMdd}.csv";
                    break;

                case "audit":
                    var logs = _context.AuditTrailEntries
                        .Include(a => a.User).Include(a => a.Document)
                        .OrderByDescending(a => a.Timestamp).ToList();
                    var auditRows = logs.Select(l => new[]
                    {
                        l.Timestamp.ToString("yyyy-MM-dd HH:mm:ss"),
                        l.User?.FullName ?? "System",
                        l.Document?.TrackingNumber ?? "-",
                        l.Action, l.Details ?? "", l.Ipaddress ?? ""
                    });
                    csvBytes = _export.GenerateCsv(auditRows,
                        ["Timestamp", "User", "Document Ref", "Action", "Details", "IP Address"]);
                    fileName = $"audit_trail_{DateTime.Now:yyyyMMdd}.csv";
                    break;

                case "escalations":
                    var esc = _context.EscalationLogs
                        .Include(e => e.Document).Include(e => e.NotifiedUser).ToList();
                    var escRows = esc.Select(e => new[]
                    {
                        e.Document?.TrackingNumber ?? "-",
                        e.Document?.Title ?? "-",
                        e.EscalationLevel,
                        e.EscalationReason,
                        e.ArtaperiodDays.ToString(),
                        e.ElapsedDays.ToString(),
                        e.EscalatedAt.ToString("yyyy-MM-dd"),
                        e.IsResolved ? "Resolved" : "Open"
                    });
                    csvBytes = _export.GenerateCsv(escRows,
                        ["Tracking No", "Document", "Level", "Reason", "ARTA Limit", "Elapsed", "Escalated On", "Status"]);
                    fileName = $"escalations_{DateTime.Now:yyyyMMdd}.csv";
                    break;

                default:
                    TempData["ExportError"] = "Unknown report type.";
                    return RedirectToAction("Index");
            }

            return File(csvBytes, "text/csv", fileName);
        }

        private static string StatusLabel(int s) => s switch
        {
            1 => "Pending",
            2 => "For Mayor Approval",
            3 => "Completed",
            4 => "Returned",
            _ => "Unknown"
        };
    }
}
