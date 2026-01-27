// src/middlewares/role.middleware.js

export const requireRole = (...allowedRoles) => {
  const allowedSet = new Set(
    allowedRoles.map((r) => String(r).toUpperCase())
  );

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rawRole =
      req.user.role ??
      req.user.userRole ??
      req.user.user_role ??
      req.user.type ??
      null;

    const role = rawRole ? String(rawRole).toUpperCase() : null;

    if (!role) {
      return res
        .status(403)
        .json({ message: "Forbidden (missing role)" });
    }

    if (!allowedSet.has(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.user.role = role;
    next();
  };
};

// ✅ backward-compatible exports (รองรับโค้ดเก่า)
export const adminOnly = requireRole("ADMIN");
export const userOnly = requireRole("USER");
