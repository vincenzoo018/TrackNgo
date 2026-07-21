using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using TrackNGoMati.Filters;
using TrackNGoMati.Models;
using TrackNGoMati.Services;

namespace TrackNGoMati.Areas.Admin.Controllers
{
    [Area("Admin")]
    [RequireLogin(SessionHelper.ROLE_ADMIN)]
    public class UserManagementController : Controller
    {
        private readonly TrackNgoDbContext _context;

        public UserManagementController(TrackNgoDbContext context) => _context = context;

        // GET: /Admin/UserManagement
        public IActionResult Index(string? tab)
        {
            ViewData["Title"]    = "System Configuration";
            ViewBag.CurrentPage  = "UserManagement";
            ViewBag.ActiveTab    = tab ?? "users";
            ViewBag.Departments  = _context.Departments.OrderBy(d => d.DepartmentName).ToList();
            ViewBag.DocTypes     = _context.DocumentTypeConfigs.OrderBy(t => t.TypeName).ToList();

            var users = _context.Users
                .Include(u => u.DepartmentNavigation)
                .OrderBy(u => u.FullName)
                .ToList();
            return View(users);
        }

        // POST: Create User
        [HttpPost]
        public IActionResult CreateUser(string fullName, string username, string password,
                                        int role, int? departmentId, string? mobileNumber, string? email)
        {
            if (_context.Users.Any(u => u.Username == username))
            {
                TempData["Error"] = $"Username '{username}' already exists.";
                return RedirectToAction("Index", new { tab = "users" });
            }

            var dept = departmentId != null ? _context.Departments.Find(departmentId) : null;
            var pwHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(password))).ToLower();

            _context.Users.Add(new User
            {
                FullName      = fullName,
                Username      = username,
                PasswordHash  = pwHash,
                ExportPasswordHash = pwHash,
                Role          = role,
                Department    = dept?.DepartmentName ?? "Unassigned",
                DepartmentId  = departmentId,
                MobileNumber  = mobileNumber,
                Email         = email,
                IsActive      = true,
                CreatedAt     = DateTime.Now
            });
            _context.SaveChanges();

            TempData["Success"] = $"User '{fullName}' created successfully.";
            return RedirectToAction("Index", new { tab = "users" });
        }

        // POST: Edit User
        [HttpPost]
        public IActionResult EditUser(int id, string fullName, int role,
                                      int? departmentId, string? mobileNumber, string? email)
        {
            var user = _context.Users.Find(id);
            if (user == null) return NotFound();

            var dept = departmentId != null ? _context.Departments.Find(departmentId) : null;
            user.FullName     = fullName;
            user.Role         = role;
            user.Department   = dept?.DepartmentName ?? user.Department;
            user.DepartmentId = departmentId;
            user.MobileNumber = mobileNumber;
            user.Email        = email;
            _context.SaveChanges();

            TempData["Success"] = $"User '{fullName}' updated successfully.";
            return RedirectToAction("Index", new { tab = "users" });
        }

        // POST: Toggle Active/Deactivate
        [HttpPost]
        public IActionResult ToggleUser(int id)
        {
            var user = _context.Users.Find(id);
            if (user == null) return NotFound();
            user.IsActive = !user.IsActive;
            _context.SaveChanges();
            TempData["Success"] = user.IsActive
                ? $"User '{user.FullName}' has been activated."
                : $"User '{user.FullName}' has been deactivated.";
            return RedirectToAction("Index", new { tab = "users" });
        }

        // POST: Delete User
        [HttpPost]
        public IActionResult DeleteUser(int id)
        {
            var user = _context.Users.Find(id);
            if (user == null) return NotFound();
            _context.Users.Remove(user);
            _context.SaveChanges();
            TempData["Success"] = $"User deleted.";
            return RedirectToAction("Index", new { tab = "users" });
        }

        // POST: Reset Password
        [HttpPost]
        public IActionResult ResetPassword(int id, string newPassword)
        {
            var user = _context.Users.Find(id);
            if (user == null) return NotFound();
            user.PasswordHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(newPassword))).ToLower();
            _context.SaveChanges();
            TempData["Success"] = $"Password for '{user.FullName}' reset successfully.";
            return RedirectToAction("Index", new { tab = "users" });
        }

        // POST: Create Department
        [HttpPost]
        public IActionResult CreateDepartment(string deptCode, string deptName)
        {
            if (_context.Departments.Any(d => d.DepartmentCode == deptCode))
            {
                TempData["Error"] = $"Department code '{deptCode}' already exists.";
                return RedirectToAction("Index", new { tab = "departments" });
            }
            _context.Departments.Add(new Department { DepartmentCode = deptCode, DepartmentName = deptName });
            _context.SaveChanges();
            TempData["Success"] = $"Department '{deptName}' created.";
            return RedirectToAction("Index", new { tab = "departments" });
        }

        // POST: Create Document Type
        [HttpPost]
        public IActionResult CreateDocType(string typeName, string? description, int defaultDays)
        {
            _context.DocumentTypeConfigs.Add(new DocumentTypeConfig
            {
                TypeName             = typeName,
                Description          = description,
                DefaultProcessingDays = defaultDays
            });
            _context.SaveChanges();
            TempData["Success"] = $"Document type '{typeName}' created.";
            return RedirectToAction("Index", new { tab = "categories" });
        }
    }
}
