import { jsPDF } from 'jspdf'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'docs', 'YourInt-Simple-Guide.pdf')

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 56
const CONTENT_W = PAGE_W - MARGIN * 2

const INK = '#0f172a'
const BODY = '#334155'
const MUTED = '#64748b'
const TEAL = '#0d9488'
const LINE = '#e2e8f0'

const doc = new jsPDF({ unit: 'pt', format: 'a4' })

let y = MARGIN

function ensure(space = 60) {
  if (y + space > PAGE_H - MARGIN) {
    doc.addPage()
    y = MARGIN
  }
}

function footer() {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text(`YourInt — Simple Guide · Page ${i} of ${pages}`, PAGE_W / 2, PAGE_H - 30, { align: 'center' })
  }
}

function titlePage() {
  doc.setFillColor(INK)
  doc.rect(0, 0, PAGE_W, 240, 'F')
  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.text('YourInt', MARGIN, 120)
  doc.setFontSize(13)
  doc.setTextColor('#5eead4')
  doc.text('RESEARCH OS — PLAIN-ENGLISH GUIDE', MARGIN, 145)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(16)
  doc.setTextColor('#cbd5e1')
  doc.text('How to use the app in simple words.', MARGIN, 190)
  doc.text('No technical talk. Just what to click and what happens next.', MARGIN, 210)

  y = 300
  const summary = [
    ['What is this app?', 'A research assistant that checks websites and finds companies for you.'],
    ['How long does it take?', 'Minutes. Sign in, start research, get a report with proof.'],
    ['Do you need to be technical?', 'No. If you can type a sentence, you can use it.'],
  ]
  for (const [title, text] of summary) {
    ensure(70)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(INK)
    doc.text(title, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(BODY)
    y += 18
    const lines = doc.splitTextToSize(text, CONTENT_W)
    doc.text(lines, MARGIN, y)
    y += lines.length * 16 + 24
  }
}

function sectionTitle(num, title) {
  ensure(90)
  doc.setDrawColor(TEAL)
  doc.setLineWidth(3)
  doc.line(MARGIN, y, MARGIN + 24, y)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(INK)
  doc.text(`${num}. ${title}`, MARGIN, y)
  y += 24
}

function paragraph(text, leading = 15) {
  ensure()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(BODY)
  const lines = doc.splitTextToSize(text, CONTENT_W)
  doc.text(lines, MARGIN, y)
  y += lines.length * leading + 6
}

function bullet(text) {
  ensure()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(BODY)
  const lines = doc.splitTextToSize(text, CONTENT_W - 16)
  doc.setFillColor(TEAL)
  doc.circle(MARGIN + 3, y - 3, 2.4, 'F')
  doc.text(lines, MARGIN + 16, y)
  y += lines.length * 15 + 5
}

function tipBox(title, text) {
  ensure(80)
  const boxY = y - 14
  doc.setDrawColor('#99f6e4')
  doc.setFillColor('#f0fdfa')
  const lines = doc.splitTextToSize(text, CONTENT_W - 40)
  const boxH = lines.length * 15 + 44
  doc.roundedRect(MARGIN, boxY, CONTENT_W, boxH, 8, 8, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(TEAL)
  doc.text(`Tip — ${title}`, MARGIN + 20, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(BODY)
  y += 16
  doc.text(lines, MARGIN + 20, y)
  y = boxY + boxH + 18
}

titlePage()

sectionTitle(1, 'What is this app?')
paragraph(
  'YourInt is a research assistant for finding and checking companies. You give it a job — like "check this website" or "find me companies in Germany" — and it does the work for you.'
)
paragraph(
  'An agent (a program that browses the internet) visits the real websites, looks at the content, and comes back with a clear report. Nothing is a guess: every finding shows the actual page it came from, so you can check it yourself.'
)

sectionTitle(2, 'Quick start')
bullet('Sign in with your email, or use Google. It takes less than a minute.')
bullet('Start research: paste a website URL, or describe the market you want to find companies in.')
bullet('Get your result: a report with proof arrives. You read it and decide what to do next.')

sectionTitle(3, 'Sign in')
bullet('New here? Click "Sign up" and create an account with email and password, or click "Continue with Google".')
bullet('If you signed up with email, check your inbox, open the confirmation message, and click the link. Then go back and sign in.')
bullet('Already have an account? Go to the sign-in page and enter your details.')
bullet('Prefer no password? Enter your email and press "Magic Link". We send you a link that signs you straight in.')

sectionTitle(4, 'How to check a website (audit)')
bullet('Go to "Research" in the menu.')
bullet('Choose "Website audit".')
bullet('Paste the website address — one per line, up to 5 sites at a time.')
bullet('Press "Start audit".')
bullet('Watch the progress, or close the window and do something else. The work continues.')
bullet('When it is done, open the report under "Results".')
paragraph(
  'The report shows problems (like wrong language or missing legal pages), how serious each one is, and what to change. Every problem links to the real page as proof. You can also share the report as a link, download it as a PDF, or get it in Dutch.'
)

sectionTitle(5, 'How to find companies (discovery)')
bullet('Go to "Research".')
bullet('Choose "Company discovery".')
bullet('Describe your market in normal words. Example: "Cloud software companies in the Netherlands, 50–200 employees".')
bullet('Press "Find companies".')
paragraph(
  'You get a list of matching companies with their websites and a short description. Press "Analyze" on any company to run a full check of its own website.'
)

sectionTitle(6, 'How to find people')
bullet('Go to "Find people" in the menu.')
bullet('Type a normal question, like "Head of sales at a logistics company in Hamburg".')
bullet('Press "Search".')
paragraph(
  'You see profiles with a match score and short quotes from each profile. Copy the link or open the profile to check. Your past searches are saved, so you can run them again anytime.'
)

sectionTitle(7, 'Leads and email')
bullet('Good companies go on your "Leads" list. From the Results page, tick the companies you like and press "Add to leads".')
bullet('On a lead you can "Enrich" it — add company details, contacts, and emails yourself.')
bullet('Press "Email" to get a ready-made first message, built from the audit report. Open it in your mail app, copy it, or send it.')
bullet('The email includes a link to the report, so the company can see the proof themselves.')
bullet('"Share" copies a link that anyone can open, even without an account.')

sectionTitle(8, 'Little tips')
bullet('One URL per line. You can send up to 5 at a time.')
bullet('For company search, say the country, industry, and size. Example: "B2B SaaS companies in Germany, 20–200 people".')
bullet('You can close the screen while work runs. The result will still arrive.')
bullet('Reports can be shared as a link, downloaded as a PDF, or translated to Dutch.')
bullet('Every finding links to the real website it came from. Click to check it yourself.')

sectionTitle(9, 'Words we use')
const words = [
  ['Audit', 'A deep look at one website, with a report at the end.'],
  ['Agent', 'The computer program that browses the web for you.'],
  ['Discovery', 'Finding new companies that fit a market you describe.'],
  ['Lead', 'A company you want to contact. Your "people to reach out to" list.'],
  ['Evidence', 'Proof — the actual page, text, or picture the agent found.'],
  ['Enrich', 'Add more detail to a lead: location, size, contacts, email.'],
]
for (const [word, meaning] of words) {
  ensure(40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text(word, MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.setFontSize(10)
  doc.text('—', MARGIN + 120, y)
  doc.setTextColor(BODY)
  const lines = doc.splitTextToSize(meaning, CONTENT_W - 140)
  doc.text(lines, MARGIN + 138, y)
  y += lines.length * 14 + 10
}

tipBox('Ready to start?', 'Go to "Research" and press "Start". The agent will do the looking while you work.')

footer()
mkdirSync(dirname(OUT), { recursive: true })
doc.save(OUT)
console.log(`Saved: ${OUT}`)
