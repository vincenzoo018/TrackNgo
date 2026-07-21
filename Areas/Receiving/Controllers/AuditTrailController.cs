using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Receiving.Controllers
{
    [Area("Receiving")]
    [RequireLogin(SessionHelper.ROLE_RECORDS)]
    public class AuditTrailController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public AuditTrailController(TrackNgoDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Audit Trail";
            ViewBag.CurrentPage = "AuditTrail";

            var trail = _context.AuditTrailEntries
                .Include(a => a.User)
                .Include(a => a.Document)
                .OrderByDescending(a => a.Timestamp)
                .ToList();

            return View(trail);
        }
    }
}
