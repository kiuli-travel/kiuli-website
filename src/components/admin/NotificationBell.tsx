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
      const response = await fetch('/api/notifications?limit=10&unread=false')
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
    // Poll for new notifications every 30 seconds
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
        body: JSON.stringify({
          action: 'read',
          notificationIds: [notificationId],
        }),
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
        body: JSON.stringify({
          action: 'read',
          markAll: true,
        }),
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
      case 'success':
        return '\u2713'
      case 'error':
        return '\u2717'
      case 'warning':
        return '\u26a0'
      default:
        return '\u2139'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return { bg: '#d4edda', text: '#155724' }
      case 'error':
        return { bg: '#f8d7da', text: '#721c24' }
      case 'warning':
        return { bg: '#fff3cd', text: '#856404' }
      default:
        return { bg: '#cce5ff', text: '#004085' }
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
    <div ref={dropdownRef} style={{ position: 'relative', marginRight: '1rem' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          fontSize: '1.25rem',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Notifications"
      >
        {'\ud83d\udd14'}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              backgroundColor: '#dc3545',
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
            right: '0',
            width: '320px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#007bff',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: '0.875rem',
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
                      borderBottom: '1px solid #f0f0f0',
                      cursor: notification.read ? 'default' : 'pointer',
                      backgroundColor: notification.read ? '#fff' : '#f8f9ff',
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
                            fontSize: '0.875rem',
                            color: '#333',
                            fontWeight: notification.read ? 400 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notification.message}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#999',
                            marginTop: '0.25rem',
                          }}
                        >
                          {formatTime(notification.createdAt)}
                        </div>
                      </div>
                      {!notification.read && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#007bff',
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
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#f8f9fa',
              textAlign: 'center',
            }}
          >
            <Link
              href="/admin/collections/notifications"
              style={{
                color: '#007bff',
                fontSize: '0.75rem',
                textDecoration: 'none',
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
