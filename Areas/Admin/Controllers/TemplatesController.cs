using Microsoft.AspNetCore.Mvc;
using TrackNGoMati.Models;
using System.Linq;
using System;

namespace TrackNGoMati.Areas.Admin.Controllers
{
    [Area("Admin")]
    public class TemplatesController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public TemplatesController(TrackNgoDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            var templates = _context.DocumentTemplates.ToList();
            return View(templates);
        }

        [HttpPost]
        public IActionResult Create(string Title, string Category, string Content)
        {
            var userId = HttpContext.Session.GetInt32("UserId") ?? 1; // Default to admin for safety
            
            var template = new DocumentTemplate
            {
                Title = Title,
                Category = Category,
                Content = Content,
                CreatedByUserId = userId,
                CreatedAt = DateTime.Now
            };
            
            _context.DocumentTemplates.Add(template);
            _context.SaveChanges();
            
            TempData["Success"] = "Template created successfully.";
            return RedirectToAction("Index");
        }
        
        [HttpPost]
        public IActionResult Delete(int id)
        {
            var template = _context.DocumentTemplates.Find(id);
            if (template != null)
            {
                _context.DocumentTemplates.Remove(template);
                _context.SaveChanges();
                TempData["Success"] = "Template deleted successfully.";
            }
            return RedirectToAction("Index");
        }
    }
}
