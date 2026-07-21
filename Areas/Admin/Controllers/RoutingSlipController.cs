using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Admin.Controllers
{
    [Area("Admin")]
    [RequireLogin(SessionHelper.ROLE_ADMIN)]
    public class RoutingSlipController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public RoutingSlipController(TrackNgoDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Routing Slips";
            ViewBag.CurrentPage = "RoutingSlip";

            var slips = _context.RoutingSlips
                .Include(r => r.Document)
                .Include(r => r.ReceivedByUser)
                .Include(r => r.TargetDepartment)
                .OrderByDescending(r => r.DateReceived)
                .ToList();

            return View(slips);
        }
    }
}
