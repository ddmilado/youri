import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, type Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, FileText, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

type Job = Database['public']['Tables']['jobs']['Row']
type Issue = NonNullable<Job['report']>['issues'][number]

export function JobsPage() {
  const { user } = useAuth()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['all-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500'
      case 'processing': return 'bg-blue-500/10 text-blue-500'
      case 'failed': return 'bg-red-500/10 text-red-500'
      default: return 'bg-gray-500/10 text-gray-500'
    }
  }

  const downloadPDF = async (job: Job) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const margin = 20

      pdf.setFontSize(24)
      pdf.text('SiteAudit Report', margin, margin)
      pdf.setFontSize(12)
      pdf.text(job.title, margin, margin + 10)
      pdf.setTextColor(100)
      pdf.text(job.url, margin, margin + 17)
      pdf.setTextColor(0)
      pdf.setFontSize(10)
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, margin + 24)

      if (job.report?.issues) {
        pdf.addPage()
        pdf.setFontSize(16)
        pdf.text('Issues Found', margin, margin)
        let yPos = margin + 10
        job.report.issues.forEach((issue, index) => {
          if (yPos > 270) { pdf.addPage(); yPos = margin }
          pdf.setFontSize(12)
          pdf.text(`${index + 1}. ${issue.title || issue.type}`, margin, yPos)
          yPos += 7
          pdf.setFontSize(10)
          pdf.setTextColor(100)
          const desc = issue.description || issue.message || 'No description'
          const lines = pdf.splitTextToSize(desc, 170)
          lines.forEach((line: string) => {
            if (yPos > 270) { pdf.addPage(); yPos = margin }
            pdf.text(line, margin, yPos)
            yPos += 7
          })
          pdf.setTextColor(0)
          yPos += 3
        })
      }

      pdf.save(`siteaudit-${job.id}.pdf`)
      toast.success('PDF downloaded!')
    } catch {
      toast.error('Failed to download PDF')
    }
  }

  const downloadExcel = (job: Job) => {
    try {
      const issues = job.report?.issues || []
      const data = issues.map((issue: Issue, index: number) => ({
        '#': index + 1,
        'Issue': issue.title || issue.type,
        'Severity': issue.severity || 'N/A',
        'Description': issue.description || issue.message || 'No description',
        'Element': issue.element || 'N/A',
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Issues')
      ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 50 }, { wch: 30 }]
      XLSX.writeFile(wb, `siteaudit-${job.id}.xlsx`)
      toast.success('Excel downloaded!')
    } catch {
      toast.error('Failed to download Excel')
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Audit History</h1>
        <p className="text-muted-foreground text-lg">View and download all your past audits</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {jobs.map((job, index) => (
            <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg line-clamp-1">{job.title}</CardTitle>
                    <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-1">{job.url}</CardDescription>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end space-y-3">
                  {job.status === 'completed' && job.report?.issuesCount !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Issues Found</span>
                      <span className="text-2xl font-bold">{job.report.issuesCount}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {job.status === 'completed' && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadPDF(job)}>
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadExcel(job)}>
                          <Download className="h-4 w-4 mr-1" />
                          Excel
                        </Button>
                      </>
                    )}
                    <Link to={`/report/${job.id}`} className={job.status === 'completed' ? '' : 'flex-1'}>
                      <Button variant={job.status === 'completed' ? 'outline' : 'default'} size="sm" className="w-full">
                        View
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No audits yet</p>
            <p className="text-sm text-muted-foreground mb-6">Create your first audit to get started</p>
            <Link to="/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Audit
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
