'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  job?: { id: string }
  itinerary?: { id: string }
  read: boolean
  createdAt: string
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10&unread=false', {
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'read', notificationIds: [notificationId] }),
      })
      fetchNotifications()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    setIsLoading(true)
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'read', markAll: true }),
      })
      fetchNotifications()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '\u2713'
      case 'error': return '\u2717'
      case 'warning': return '\u26a0'
      default: return '\u2139'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return { bg: '#E8F5E9', text: '#2E7D32' }
      case 'error': return { bg: '#FDECEA', text: '#C62828' }
      case 'warning': return { bg: '#FFF8E1', text: '#E65100' }
      default: return { bg: '#E8EFF5', text: '#486A6A' }
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', padding: '0.5rem 1rem', marginTop: '0.5rem' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: '#F9F8F5',
          border: '1px solid #DADADA',
          borderRadius: '4px',
          cursor: 'pointer',
          padding: '0.5rem 1rem',
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: '#404040',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          fontFamily: "'Satoshi', system-ui, sans-serif",
          transition: 'background-color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F5F3EB'
          e.currentTarget.style.borderColor = '#486A6A'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#F9F8F5'
          e.currentTarget.style.borderColor = '#DADADA'
        }}
        title="Notifications"
      >
        <span style={{ fontSize: '0.875rem' }}>{'\ud83d\udd14'}</span>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span
            style={{
              backgroundColor: '#DA7A5A',
              color: '#fff',
              fontSize: '0.625rem',
              fontWeight: 700,
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              marginLeft: 'auto',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            maxHeight: '400px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            border: '1px solid #E5E2DB',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #E5E2DB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F9F8F5',
              flexShrink: 0,
            }}
          >
            <span style={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: '#2d2d2d',
              fontFamily: "'General Sans', system-ui, sans-serif",
            }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#486A6A',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  fontWeight: 500,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: '#888',
                  fontSize: '0.8125rem',
                  fontFamily: "'Satoshi', system-ui, sans-serif",
                }}
              >
                No notifications
              </div>
            ) : (
              notifications.map((notification) => {
                const color = getTypeColor(notification.type)
                return (
                  <div
                    key={notification.id}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #F0EDE6',
                      cursor: notification.read ? 'default' : 'pointer',
                      backgroundColor: notification.read ? '#fff' : '#FAFAF7',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: color.bg,
                          color: color.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}
                      >
                        {getTypeIcon(notification.type)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: '#404040',
                            fontWeight: notification.read ? 400 : 500,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: '1.4',
                          }}
                        >
                          {notification.message}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: '0.25rem' }}>
                          {formatTime(notification.createdAt)}
                        </div>
                      </div>
                      {!notification.read && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#DA7A5A',
                            flexShrink: 0,
                            marginTop: '6px',
                          }}
                        />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.5rem 1rem',
              borderTop: '1px solid #E5E2DB',
              backgroundColor: '#F9F8F5',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            <Link
              href="/admin/collections/notifications"
              style={{
                color: '#486A6A',
                fontSize: '0.75rem',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
