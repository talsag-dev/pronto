'use client';

import { useState, useEffect } from 'react';
import { Card, Title, Text, Badge, Button, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '@tremor/react';

interface Organization {
  id: string;
  name: string;
  business_phone: string | null;
  whatsapp_status: string;
  connected_phone?: string;
  has_session_data?: boolean;
}

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/status');
      const data = await res.json();
      console.log('Admin status response:', data);
      if (data.success) {
        setOrgs(data.organizations || []);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (e: any) {
      console.error('Error fetching status:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const resetConnection = async (orgId: string) => {
    if (!confirm('Are you sure you want to reset the connection?\n\nThis will:\n1. Close the active WhatsApp connection\n2. Delete all session data\n3. Require re-scanning QR code')) return;
    
    try {
        const res = await fetch(`/api/whatsapp/session?orgId=${orgId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          alert('✅ Session terminated successfully!\n\nYou can now generate a new QR code in Settings.');
        } else {
          alert(`❌ Error: ${data.error}`);
        }
        fetchStatus();
    } catch (e: any) {
        alert(`❌ Failed to reset: ${e.message}`);
    }
  };

  return (
    <div className="p-6">
      <Title>Admin Status Dashboard</Title>
      <Text>Monitor active WhatsApp connections</Text>

      {error && (
        <Card className="mt-6 bg-red-50">
          <Text className="text-red-600">Error: {error}</Text>
        </Card>
      )}

      {loading ? (
        <Card className="mt-6">
          <Text>Loading...</Text>
        </Card>
      ) : (
        <Card className="mt-6">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Organization</TableHeaderCell>
                <TableHeaderCell>Connected Phone</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Session Data</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{org.name}</span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {org.connected_phone || '-'}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      org.whatsapp_status === 'connected' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {org.whatsapp_status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      org.has_session_data 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {org.has_session_data ? 'Present' : 'None'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => resetConnection(org.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Force Reset
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      <div className="mt-6">
          <Text className="text-sm text-gray-500">
              Note: "No session found to decrypt" errors usually mean the session files are out of sync. 
              Use "Force Reset" to clear the session and start over.
          </Text>
      </div>
    </div>
  );
}
