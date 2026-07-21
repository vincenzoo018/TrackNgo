using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Cart.Controllers
{
    [Area("Cart")]
    [RequireLogin(SessionHelper.ROLE_CART)]
    public class NotificationController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public NotificationController(TrackNgoDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Notifications";
            ViewBag.CurrentPage = "Notification";

            var notifications = _context.Smsnotifications
                .Include(n => n.Document)
                .Include(n => n.RecipientUser)
                .OrderByDescending(n => n.QueuedAt)
                .ToList();

            return View(notifications);
        }
    }
}
