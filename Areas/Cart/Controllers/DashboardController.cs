using Microsoft.AspNetCore.Mvc;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;
using System.Linq;
using System;

namespace TrackNGoMati.Areas.Cart.Controllers
{
    [Area("Cart")]
    [RequireLogin(SessionHelper.ROLE_CART)]
    public class DashboardController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public DashboardController(TrackNgoDbContext context)
        {
            _context = context;
        }

                public IActionResult Index()
        {
            ViewData["Title"] = "Cart Dashboard";
            ViewBag.CurrentPage = "Dashboard";

            var docs = _context.Documents.ToList();
            
            ViewBag.TotalDocs = docs.Count;
            ViewBag.PendingDocs = docs.Count(d => d.CurrentStatus == 1 || d.CurrentStatus == 2);
            ViewBag.CompletedDocs = docs.Count(d => d.CurrentStatus == 3);
            
            var today = System.DateTime.Now;
            var overdue = docs.Where(d => d.CurrentStatus != 3 && (today - d.DateFiled).TotalDays > d.ArtaprocessingDays).ToList();
            ViewBag.OverdueDocs = overdue;

            if (3 > 0) {
                ViewBag.ActionNeeded = docs.Where(d => d.CurrentStepIndex == 3 && d.CurrentStatus != 3).ToList();
            } else {
                ViewBag.ActionNeeded = new List<Document>(); // Admin sees all or none
            }

            // Funnel data
            ViewBag.Step1Count = docs.Count(d => d.CurrentStepIndex == 1 && d.CurrentStatus != 3);
            ViewBag.Step2Count = docs.Count(d => d.CurrentStepIndex == 2 && d.CurrentStatus != 3);
            ViewBag.Step3Count = docs.Count(d => d.CurrentStepIndex == 3 && d.CurrentStatus != 3);
            ViewBag.Step4Count = docs.Count(d => d.CurrentStepIndex == 4 && d.CurrentStatus != 3);

            return View();
        }
    }
}

