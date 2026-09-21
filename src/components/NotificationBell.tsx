import React, { useState, useEffect } from "react";
import { Bell, X, CheckCircle2, MessageSquare, Clock, Eye, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Announcement {
  _id: string;
  id?: string;
  title: string;
  content: string;
  target_role?: string;
  target_type?: string;
  sender_role: string;
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  isRead?: boolean;
  is_edited?: boolean;
  edited_at?: string;
  category_id?: string;
}

export const NotificationBell = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("read_announcements");
    return new Set(saved ? JSON.parse(saved) : []);
  });

  const getNotificationsUrl = () => {
    const userStr = sessionStorage.getItem("user");
    let user: any = null;
    try {
      user = userStr && userStr !== "undefined" ? JSON.parse(userStr) : null;
    } catch (error) {
      user = null;
    }
    const role = user?.role?.toLowerCase();
    if (role === "admin" || role === "superadmin") {
      return "/dashboard/system/notifications";
    }
    return "/dashboard/student/notifications";
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        const announcements: Announcement[] = (Array.isArray(data) ? data : []).map((a: any) => {
          const resolvedId = a._id?.$oid || a._id || a.id || "";
          return {
            ...a,
            _id: resolvedId,
            id: resolvedId,
          };
        });
        setNotifications(announcements);
        const unread = announcements.filter(a => !readAnnouncements.has(a._id || a.id || "")).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (announcementId: string) => {
    const newRead = new Set(readAnnouncements);
    newRead.add(announcementId);
    setReadAnnouncements(newRead);
    localStorage.setItem("read_announcements", JSON.stringify([...newRead]));
    const unread = notifications.filter(a => !newRead.has(a._id)).length;
    setUnreadCount(unread);
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(a => a._id));
    setReadAnnouncements(allIds);
    localStorage.setItem("read_announcements", JSON.stringify([...allIds]));
    setUnreadCount(0);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case "high":
        return <Bell className="w-4 h-4 text-amber-500" />;
      case "medium":
        return <MessageSquare className="w-4 h-4 text-yellow-500" />;
      case "low":
      default:
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "high":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "low":
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2.5 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 transition-colors relative group"
        >
          <Bell className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-accent text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-black shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[500px] overflow-y-auto rounded-2xl border-border/60 bg-white dark:bg-card p-2 shadow-2xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 py-3 flex items-center justify-between">
          {t("Notifications")}
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markAllAsRead();
              }}
              className="text-xs font-bold text-primary hover:text-primary-dark transition-colors"
            >
              {t("Mark all as read")}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-2 bg-border/60" />
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-xs text-muted-foreground mt-2">{t("Loading...")}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-3">
              {t("No notifications")}
            </p>
          </div>
        ) : (
          notifications.slice(0, 5).map((notification, idx) => (
            <DropdownMenuItem
              key={notification._id || notification.id || `notif-${idx}`}
              className="p-0 mb-1 last:mb-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(getNotificationsUrl());
                setIsOpen(false);
              }}
            >
              <div
                className={cn(
                  "w-full p-4 rounded-xl transition-colors",
                  !readAnnouncements.has(notification._id)
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        !readAnnouncements.has(notification._id) ? "bg-primary/20" : "bg-muted/50"
                      )}
                    >
                      {getPriorityIcon(notification.priority)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p
                        className={cn(
                          "text-sm font-bold text-foreground truncate",
                          !readAnnouncements.has(notification._id) && "font-black"
                        )}
                      >
                        {notification.title}
                      </p>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                          getPriorityColor(notification.priority)
                        )}
                      >
                        {t(notification.priority)}
                      </span>
                      {notification.is_edited && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700">
                          Edited
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {notification.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(notification.created_at), "MMM d, h:mm a")}
                        {notification.is_edited && notification.edited_at && (
                          <> · Edited: {format(new Date(notification.edited_at), "MMM d, h:mm a")}</>
                        )}
                      </span>
                      {!readAnnouncements.has(notification._id) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAsRead(notification._id);
                          }}
                          className="text-[10px] font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {t("Mark as read")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="mx-2 bg-border/60" />
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(getNotificationsUrl());
            setIsOpen(false);
          }}
          className="p-3 text-center"
        >
          <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center justify-center gap-2">
            {t("View all notifications")}
            <Eye className="w-3 h-3" />
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
