import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  MessageSquare, 
  Smartphone, 
  Send, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Hash, 
  Layers, 
  Check, 
  FileText,
  Clock,
  Radio
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface GatewayConfig {
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_api_key: string;
  whatsapp_sender_number: string;
  whatsapp_template_admission: string;
  whatsapp_template_admit_card: string;
  whatsapp_template_marksheet: string;
  whatsapp_template_fee: string;
  whatsapp_template_birthday: string;

  sms_enabled: boolean;
  sms_provider: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_template_admission: string;
  sms_template_admit_card: string;
  sms_template_marksheet: string;
  sms_template_fee: string;
  sms_template_birthday: string;
}

interface NotificationLog {
  id?: string;
  channel: string;
  recipient: string;
  template_type: string;
  message: string;
  status: string;
  provider_response?: string;
  created_at: string;
}

export const AdminNotificationSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'sms' | 'test' | 'logs'>('whatsapp');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Test Dispatch form state
  const [testChannel, setTestChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [testRecipient, setTestRecipient] = useState('+919876543210');
  const [testName, setTestName] = useState('Rahul Verma');
  const [testTemplate, setTestTemplate] = useState('admission');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const token = localStorage.getItem('token');

  const fetchConfig = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/notifications/config'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to load gateway configuration' });
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/notifications/logs'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchConfig(), fetchLogs()]);
      setIsLoading(false);
    };
    loadAll();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch(apiUrl('/api/admin/notifications/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Gateway configuration saved successfully!' });
      } else {
        throw new Error(data.message || 'Failed to save');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch(apiUrl('/api/admin/notifications/send-test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          channel: testChannel,
          recipient: testRecipient,
          recipient_name: testName,
          template_type: testTemplate
        })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        fetchLogs(); // refresh logs
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Test dispatch failed' });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span>Loading Automated Notification Gateway Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Automated WhatsApp & SMS Gateway
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure automated triggers for admissions, exam roll numbers, marksheet dispatch, fee alerts & birthdays.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-medium ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/50 border border-rose-500/30 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'whatsapp'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 border-x border-slate-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-400" /> WhatsApp Cloud Gateway
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'sms'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500 border-x border-slate-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4 text-blue-400" /> SMS / DLT Gateway
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'test'
              ? 'bg-slate-900 text-purple-400 border-t-2 border-purple-500 border-x border-slate-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4 text-purple-400" /> Test Dispatch Sandbox
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-500 border-x border-slate-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" /> Dispatch Audit Logs ({logs.length})
        </button>
      </div>

      {/* WhatsApp Gateway Settings Form */}
      {activeTab === 'whatsapp' && (
        <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" /> WhatsApp Business API Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure Meta WhatsApp Cloud API credentials and automated message templates.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.whatsapp_enabled} 
                onChange={(e) => setConfig({ ...config, whatsapp_enabled: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-3 text-xs font-semibold text-slate-300">
                {config.whatsapp_enabled ? 'Active / Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Provider</label>
              <select
                value={config.whatsapp_provider}
                onChange={(e) => setConfig({ ...config, whatsapp_provider: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="meta_cloud">Meta Cloud API (Official)</option>
                <option value="twilio">Twilio Programmable Messaging</option>
                <option value="ultramsg">UltraMsg Gateway</option>
                <option value="generic_webhook">Custom HTTP Webhook</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Sender Phone Number</label>
              <input
                type="text"
                value={config.whatsapp_sender_number}
                onChange={(e) => setConfig({ ...config, whatsapp_sender_number: e.target.value })}
                placeholder="+919876543210"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">API Key / Access Token</label>
              <input
                type="password"
                value={config.whatsapp_api_key}
                onChange={(e) => setConfig({ ...config, whatsapp_api_key: e.target.value })}
                placeholder="EAAG..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Automated Notification Templates
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                1. Admission Confirmation Template <span className="text-slate-500">(Variables: {'{name}'}, {'{course}'}, {'{enrollment}'})</span>
              </label>
              <textarea
                rows={2}
                value={config.whatsapp_template_admission}
                onChange={(e) => setConfig({ ...config, whatsapp_template_admission: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                2. Admit Card / Exam Schedule Notification <span className="text-slate-500">(Variables: {'{name}'}, {'{exam_title}'}, {'{date}'}, {'{center}'})</span>
              </label>
              <textarea
                rows={2}
                value={config.whatsapp_template_admit_card}
                onChange={(e) => setConfig({ ...config, whatsapp_template_admit_card: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                3. Marksheet & Certificate Release <span className="text-slate-500">(Variables: {'{name}'}, {'{course}'}, {'{grade}'}, {'{percentage}'})</span>
              </label>
              <textarea
                rows={2}
                value={config.whatsapp_template_marksheet}
                onChange={(e) => setConfig({ ...config, whatsapp_template_marksheet: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                4. Fee Receipt Payment Alert <span className="text-slate-500">(Variables: {'{name}'}, {'{course}'}, {'{amount}'}, {'{receipt_no}'})</span>
              </label>
              <textarea
                rows={2}
                value={config.whatsapp_template_fee}
                onChange={(e) => setConfig({ ...config, whatsapp_template_fee: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                5. Birthday Greeting Wishes <span className="text-slate-500">(Variables: {'{name}'})</span>
              </label>
              <textarea
                rows={2}
                value={config.whatsapp_template_birthday}
                onChange={(e) => setConfig({ ...config, whatsapp_template_birthday: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-sans"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save WhatsApp Configuration
            </button>
          </div>
        </form>
      )}

      {/* SMS Gateway Settings Form */}
      {activeTab === 'sms' && (
        <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" /> SMS / DLT Gateway Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure Fast2SMS / MSG91 credentials, DLT Sender Header ID, and compliant SMS templates.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.sms_enabled} 
                onChange={(e) => setConfig({ ...config, sms_enabled: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-xs font-semibold text-slate-300">
                {config.sms_enabled ? 'Active / Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SMS Provider</label>
              <select
                value={config.sms_provider}
                onChange={(e) => setConfig({ ...config, sms_provider: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="fast2sms">Fast2SMS (Quick SMS & DLT)</option>
                <option value="msg91">MSG91 Enterprise Gateway</option>
                <option value="twilio">Twilio SMS</option>
                <option value="generic_webhook">Custom SMS Webhook</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">DLT Sender ID (6 Chars)</label>
              <input
                type="text"
                value={config.sms_sender_id}
                onChange={(e) => setConfig({ ...config, sms_sender_id: e.target.value })}
                placeholder="SCREIN"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">API Key / Token</label>
              <input
                type="password"
                value={config.sms_api_key}
                onChange={(e) => setConfig({ ...config, sms_api_key: e.target.value })}
                placeholder="SMS_API_KEY_..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* SMS Templates */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              DLT Approved SMS Templates
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                1. Admission SMS Template
              </label>
              <input
                type="text"
                value={config.sms_template_admission}
                onChange={(e) => setConfig({ ...config, sms_template_admission: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                2. Hall Ticket / Exam SMS Template
              </label>
              <input
                type="text"
                value={config.sms_template_admit_card}
                onChange={(e) => setConfig({ ...config, sms_template_admit_card: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                3. Marksheet / Result SMS Template
              </label>
              <input
                type="text"
                value={config.sms_template_marksheet}
                onChange={(e) => setConfig({ ...config, sms_template_marksheet: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                4. Fee Confirmation SMS Template
              </label>
              <input
                type="text"
                value={config.sms_template_fee}
                onChange={(e) => setConfig({ ...config, sms_template_fee: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                5. Birthday Greeting SMS Template
              </label>
              <input
                type="text"
                value={config.sms_template_birthday}
                onChange={(e) => setConfig({ ...config, sms_template_birthday: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save SMS Configuration
            </button>
          </div>
        </form>
      )}

      {/* Test Dispatch Sandbox */}
      {activeTab === 'test' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" /> Gateway Sandbox & Test Dispatcher
            </h2>
            <p className="text-xs text-slate-400">
              Send an instant live or simulated notification to verify credentials, template variables, and delivery.
            </p>
          </div>

          <form onSubmit={handleSendTest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Channel</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value="whatsapp"
                    checked={testChannel === 'whatsapp'}
                    onChange={() => setTestChannel('whatsapp')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>WhatsApp Message</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value="sms"
                    checked={testChannel === 'sms'}
                    onChange={() => setTestChannel('sms')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>SMS (DLT)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Template Preset</label>
              <select
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="admission">Admission Confirmation</option>
                <option value="admit_card">Admit Card / Exam Schedule</option>
                <option value="marksheet">Marksheet / Result Release</option>
                <option value="fee">Fee Payment Receipt</option>
                <option value="birthday">Birthday Greeting</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Mobile Number</label>
              <input
                type="text"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="+919876543210"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Student / Recipient Name</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Rahul Verma"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={isSendingTest}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {isSendingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Dispatch Test Notification
              </button>
            </div>
          </form>

          {/* Test Result Display */}
          {testResult && (
            <div className={`p-4 rounded-xl border ${
              testResult.success ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-rose-950/40 border-rose-500/30'
            }`}>
              <div className="flex items-center gap-2 text-xs font-bold text-white mb-2">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{testResult.message}</span>
              </div>
              {testResult.rendered_message && (
                <div className="mt-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap font-sans">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rendered Message Payload:</span>
                  {testResult.rendered_message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Logs Table */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Recent Dispatch Logs & Delivery Audit
            </h2>
            <span className="text-xs text-slate-400">{logs.length} logged messages</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Template</th>
                  <th className="p-3">Message Preview</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      No notifications logged yet. Trigger an automated event or send a test dispatch above!
                    </td>
                  </tr>
                ) : (
                  logs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 whitespace-nowrap text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.channel === 'whatsapp' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {log.channel.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-200">{log.recipient}</td>
                      <td className="p-3 font-medium text-purple-300 capitalize">{log.template_type}</td>
                      <td className="p-3 max-w-xs truncate text-slate-400" title={log.message}>
                        {log.message}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
