'use client'

import { useState, useEffect } from 'react'
import { Users, BarChart, Send, ChevronRight, Mail, Twitter, Linkedin, Instagram, MessageSquare } from 'lucide-react'

export function CrmDashboardClient({ venture }: { venture: any }) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'leads' | 'outreach' | 'replies'>('analytics')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)

  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [campaignType, setCampaignType] = useState('initial_outreach')

  useEffect(() => {
    fetchData()
  }, [venture.id])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/analytics`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDispatch() {
    setDispatchStatus('Sending...')
    try {
      const res = await fetch(`/api/ventures/${venture.id}/crm/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType,
          emailSubject,
          emailBody
        })
      })
      const result = await res.json()
      if (result.success) {
        setDispatchStatus(`Success! Sent to ${result.sentCount} leads.`)
        fetchData()
      } else {
        setDispatchStatus(`Error: ${result.error}`)
      }
    } catch (e: any) {
      setDispatchStatus(`Error: ${e.message}`)
    }
  }

  if (loading) return <div className="p-8 text-[var(--text-soft)] animate-pulse">Loading CRM Data...</div>

  return (
    <div className="max-w-5xl mx-auto p-8 font-sans space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight text-[var(--text)]">{venture.name} CRM</h1>
          <p className="text-[var(--text-soft)] mt-1">Manage leads, track conversion, and engage with replies.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-[var(--border)] pb-px">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart },
          { id: 'replies', label: 'Social Replies', icon: MessageSquare },
          { id: 'leads', label: 'Leads', icon: Users },
          { id: 'outreach', label: 'Outreach', icon: Send },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.id 
                ? 'border-[var(--accent)] text-[var(--accent)]' 
                : 'border-transparent text-[var(--text-soft)] hover:text-[var(--text)]'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2 opacity-70" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-medium text-[var(--text)] mb-4">Conversion Funnel</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-soft)] mb-1">Total Web Visitors</div>
                  <div className="text-3xl tracking-tight text-[var(--text)]">{data?.visitors?.toLocaleString() || 0}</div>
                </div>
                <div className="p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)] relative overflow-hidden">
                  <div className="text-sm text-[var(--text-soft)] mb-1">Leads Captured</div>
                  <div className="text-3xl tracking-tight text-[var(--text)]">{data?.leads?.toLocaleString() || 0}</div>
                  <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--border)] opacity-50" />
                </div>
                <div className="p-4 bg-[var(--accent-soft)] rounded-lg border border-[var(--accent)]/20">
                  <div className="text-sm text-[var(--accent)] font-medium mb-1">Conversion Rate</div>
                  <div className="text-3xl tracking-tight text-[var(--accent)]">{data?.conversionRate || '0.00'}%</div>
                </div>
              </div>
            </div>

            {data?.socialBreakdown && (
              <div>
                <h2 className="text-lg font-medium text-[var(--text)] mb-4">Traffic Source Attribution</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {data.socialBreakdown.map((social: any) => (
                    <div key={social.platform} className="p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)] flex items-start space-x-3">
                      <div className={`p-2 rounded-md bg-[var(--card)] border border-[var(--border)] ${social.color}`}>
                         {social.platform === 'Twitter (X)' ? <Twitter className="w-5 h-5" /> :
                          social.platform === 'LinkedIn' ? <Linkedin className="w-5 h-5" /> :
                          <Instagram className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[var(--text)]">{social.platform}</div>
                        <div className="text-xs text-[var(--text-soft)] mt-1">{social.count.toLocaleString()} reach/clicks</div>
                        <div className="text-xs text-[var(--accent)] mt-0.5">{social.leads} leads generated</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'replies' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h2 className="text-lg font-medium text-[var(--text)]">Social Post Replies</h2>
               <div className="text-sm bg-[var(--bg)] px-3 py-1 rounded-full border border-[var(--border)] text-[var(--text-soft)]">
                 {data?.socialComments?.length || 0} Total Replies
               </div>
            </div>

            {data?.socialComments && data.socialComments.length > 0 ? (
               <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-soft)]">
                     <tr>
                       <th className="px-4 py-3 font-medium">User</th>
                       <th className="px-4 py-3 font-medium">Platform / Post</th>
                       <th className="px-4 py-3 font-medium">Comment</th>
                       <th className="px-4 py-3 font-medium text-right">Time</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
                     {data.socialComments.map((comment: any, i: number) => (
                       <tr key={i} className="hover:bg-[var(--bg)] transition-colors">
                         <td className="px-4 py-3 font-medium">@{comment.username}</td>
                         <td className="px-4 py-3">
                           <div className="text-[var(--text-soft)]">{comment.platform}</div>
                           <div className="text-xs max-w-[200px] truncate">{comment.assetTitle}</div>
                         </td>
                         <td className="px-4 py-3 max-w-sm">
                           <p className="line-clamp-2" title={comment.text}>{comment.text}</p>
                         </td>
                         <td className="px-4 py-3 text-right text-[var(--text-soft)] text-xs">
                            {new Date(comment.timestamp).toLocaleDateString()}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            ) : (
               <div className="py-12 text-center border border-dashed border-[var(--border)] rounded-lg text-[var(--text-soft)]">
                 No social replies found. Publish assets from the Marketing module to start tracking engagement.
               </div>
            )}
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between">
               <h2 className="text-lg font-medium text-[var(--text)]">Lead Directory</h2>
               <div className="text-sm bg-[var(--bg)] px-3 py-1 rounded-full border border-[var(--border)] text-[var(--text-soft)]">
                 {data?.leads?.toLocaleString() || 0} Total
               </div>
             </div>
             
             {data?.rawAnalytics && data.rawAnalytics.length > 0 ? (
               <div className="text-sm text-[var(--text-soft)] italic">
                 (Leads fetched from actual DB, rendering list here...)
               </div>
             ) : (
               <div className="py-12 text-center border border-dashed border-[var(--border)] rounded-lg text-[var(--text-soft)]">
                 No leads captured yet. Drive traffic to your landing page!
               </div>
             )}
          </div>
        )}

        {activeTab === 'outreach' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-[var(--text)]">Automated Campaign</h2>
            <p className="text-sm text-[var(--text-soft)]">Dispatch emails to your captured leads using AI-generated marketing copy.</p>
            
            <div className="space-y-4 mt-6">
              <div>
                <label className="block text-sm text-[var(--text-soft)] mb-1">Campaign Type</label>
                <select 
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="initial_outreach">Welcome / Initial Outreach</option>
                  <option value="follow_up">Product Update Follow-up</option>
                  <option value="newsletter">Weekly Newsletter</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-soft)] mb-1">Email Subject</label>
                <input 
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Welcome to the waitlist!"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-soft)] mb-1">Email Body</label>
                <textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  placeholder="Hi {{name}},&#10;&#10;Thanks for joining..."
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono resize-y"
                />
                <div className="text-xs text-[var(--muted)] mt-1">Use {'{{name}}'} to inject the lead's name.</div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-[var(--border)]">
                <div className="text-sm font-medium text-[var(--accent)]">
                  {dispatchStatus}
                </div>
                <button
                  onClick={handleDispatch}
                  disabled={!emailSubject || !emailBody}
                  className="flex items-center px-4 py-2 bg-[var(--text)] text-[var(--bg)] rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Dispatch to {data?.leads?.toLocaleString() || 0} Leads
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
