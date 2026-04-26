import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Inbox, CheckSquare, Trash2, Settings, Sun, Moon, PanelLeftClose, PanelLeft, Mail, FolderOpen } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const NAV_ITEMS = [
  { to: "/", label: "Inbox", icon: Inbox },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/trash", label: "Trash", icon: Trash2 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("mailroom-sidebar-collapsed") === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("mailroom-sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 transition-all duration-200 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-zinc-200 dark:border-zinc-800">
          <Mail className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">
              Mailroom
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium no-underline transition-colors duration-150 ${
                  active
                    ? "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="flex flex-col gap-1 px-2 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors duration-150 border-0 bg-transparent cursor-pointer w-full text-left"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
          </button>
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors duration-150 border-0 bg-transparent cursor-pointer w-full text-left"
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4 shrink-0" />
            ) : (
              <PanelLeftClose className="w-4 h-4 shrink-0" />
            )}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
