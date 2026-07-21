using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.DepartmentHead.Controllers
{
    [Area("DepartmentHead")]
    [RequireLogin(SessionHelper.ROLE_DEPT)]
    public class SignatureController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public SignatureController(TrackNgoDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Signatures";
            ViewBag.CurrentPage = "Signature";

            var userId = HttpContext.Session.GetInt32(SessionHelper.KEY_USER_ID);

            var signatures = _context.DigitalSignatures
                .Include(s => s.Document)
                .Include(s => s.SignedByUser)
                .Where(s => s.SignedByUserId == userId)
                .OrderByDescending(s => s.SignedAt)
                .ToList();

            return View(signatures);
        }
    }
}
