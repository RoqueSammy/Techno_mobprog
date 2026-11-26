from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont
import os, re

SRC = r"C:\Users\Sama Rooks\Downloads\G-6_FINALS WRITTEN REPORT_DRAFT.docx"
OUTDIR = r"D:\h\output"
TMP = r"D:\h\tmp\report_revision"
os.makedirs(OUTDIR, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
OUT = os.path.join(OUTDIR, "G-6_FINALS_WRITTEN_REPORT_REVISED.docx")

NAVY = (23, 37, 84)
YELLOW = (246, 174, 0)
INK = (34, 41, 52)
MUTED = (97, 107, 120)
PALE = (242, 246, 250)
LINE = (213, 221, 231)

def font(size, bold=False):
    path = r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"
    return ImageFont.truetype(path, size)

def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        test = word if not cur else cur + " " + word
        if draw.textbbox((0, 0), test, font=fnt)[2] <= max_width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = word
    if cur: lines.append(cur)
    return lines

def draw_lines(draw, xy, text, fnt, fill, width, leading=7):
    x, y = xy
    for line in wrap_text(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + leading
    return y

def make_wireframes(path):
    W, H = 1800, 920
    im = Image.new("RGB", (W, H), (249, 250, 252)); d = ImageDraw.Draw(im)
    d.text((60, 38), "TRAIL-IT | LOW-FIDELITY WIREFRAMES", font=font(34, True), fill=NAVY)
    d.text((60, 84), "Concept design for the USTP Cagayan de Oro pilot. Map labels and locations are placeholders pending campus verification.", font=font(20), fill=MUTED)
    labels = ["01  CAMPUS MAP", "02  SEARCH RESULTS", "03  DESTINATION DETAILS"]
    x0s = [90, 675, 1260]
    for x, label in zip(x0s, labels):
        d.text((x, 142), label, font=font(23, True), fill=NAVY)
        d.rounded_rectangle((x, 184, x+450, 860), radius=32, fill="white", outline=LINE, width=4)
        d.rounded_rectangle((x+13, 197, x+437, 246), radius=22, fill=NAVY)
        d.text((x+28, 209), "TRAIL-IT", font=font(19, True), fill="white")
        d.text((x+380, 208), "...", font=font(20, True), fill="white")
    # Map home
    x=x0s[0]
    d.rounded_rectangle((x+27, 264, x+423, 317), radius=14, fill=PALE, outline=LINE, width=2)
    d.text((x+45, 278), "Search buildings, rooms, offices", font=font(17), fill=MUTED)
    # schematic paths
    for pts in [[(x+48,370),(x+180,410),(x+385,365)],[(x+60,600),(x+205,540),(x+390,650)],[(x+95,360),(x+130,700)],[(x+335,360),(x+300,705)]]:
        d.line(pts, fill=(196,207,218), width=10)
    blocks=[(x+83,415,"BUILDING A"),(x+247,445,"OFFICE"),(x+85,590,"FACILITY"),(x+250,610,"BUILDING B")]
    for bx,by,txt in blocks:
        d.rounded_rectangle((bx,by,bx+125,by+75), radius=10, fill=(232,239,247), outline=(173,190,209), width=2)
        draw_lines(d,(bx+10,by+21),txt,font(14,True),NAVY,105,3)
    for px,py in [(x+143,397),(x+310,429),(x+145,572),(x+310,591)]:
        d.ellipse((px-15,py-15,px+15,py+15), fill=YELLOW, outline=NAVY, width=3)
    d.rounded_rectangle((x+350, 778, x+405, 833), radius=26, fill=NAVY)
    d.text((x+369, 790), "⌖", font=font(24, True), fill="white")
    # Search results
    x=x0s[1]
    d.text((x+28, 270), "Find a campus location", font=font(23, True), fill=INK)
    d.rounded_rectangle((x+27, 316, x+423, 372), radius=14, fill=PALE, outline=LINE, width=2)
    d.text((x+45, 333), "student services", font=font(19), fill=INK)
    results=[("Student Services", "Building A · Main entrance"),("Registrar's Office", "Building A · Room 102"),("Information Desk", "Main gate · Ground level")]
    y=397
    for title,sub in results:
        d.rounded_rectangle((x+28,y,x+422,y+112), radius=15, fill="white", outline=LINE, width=2)
        d.ellipse((x+45,y+26,x+83,y+64), fill=(255,242,205), outline=YELLOW, width=2)
        d.text((x+100,y+22),title,font=font(18,True),fill=NAVY)
        d.text((x+100,y+56),sub,font=font(15),fill=MUTED)
        d.text((x+100,y+82),"View location  ›",font=font(14,True),fill=(42,104,165))
        y += 126
    # Destination details
    x=x0s[2]
    d.rounded_rectangle((x+28, 268, x+422, 436), radius=16, fill=(232,239,247), outline=LINE, width=2)
    d.text((x+48, 328), "BUILDING A", font=font(25, True), fill=NAVY)
    d.text((x+48, 369), "Illustrative campus image area", font=font(15), fill=MUTED)
    d.text((x+30, 459), "Student Services", font=font(24, True), fill=INK)
    d.text((x+30, 501), "Building A · Ground floor", font=font(18), fill=MUTED)
    d.text((x+30, 536), "Entrance and room details to be confirmed with USTP.", font=font(15), fill=MUTED)
    d.rounded_rectangle((x+30, 611, x+420, 672), radius=14, fill=NAVY)
    d.text((x+139, 629), "SHOW WALKING ROUTE", font=font(17, True), fill="white")
    d.text((x+31, 703), "Route shown only after path data is verified.", font=font(15), fill=MUTED)
    d.text((60, 884), "Illustrative wireframe only; not a functioning prototype or verified campus map.", font=font(18, True), fill=(143, 87, 0))
    im.save(path, quality=95)

def make_vpc(path):
    W,H=1800,1060
    im=Image.new("RGB",(W,H),(249,250,252)); d=ImageDraw.Draw(im)
    d.text((55,35),"TRAIL-IT VALUE PROPOSITION CANVAS",font=font(33,True),fill=NAVY)
    d.text((55,82),"Primary user: USTP Cagayan de Oro student  |  Institutional customer: University administration",font=font(19),fill=MUTED)
    # vertical panels
    d.rounded_rectangle((45,135,880,1010),radius=24,fill=(239,244,250),outline=LINE,width=3)
    d.rounded_rectangle((920,135,1755,1010),radius=24,fill=(255,248,226),outline=(238,211,145),width=3)
    d.text((78,160),"CUSTOMER PROFILE · STUDENT",font=font(24,True),fill=NAVY)
    d.text((955,160),"VALUE MAP · TRAIL-IT",font=font(24,True),fill=NAVY)
    left=[("CUSTOMER JOBS",["Find unfamiliar buildings, rooms, and offices","Choose an entrance and reach a destination on time","Check reliable campus location information"]),
          ("PAINS",["Unclear building and room codes","Time lost asking around or searching","Weak connectivity may interrupt map access"]),
          ("EXPECTED GAINS",["Find places independently","Recognize the destination before arriving","Use current, easy-to-search campus details"])]
    right=[("PRODUCTS & SERVICES",["Searchable CDO campus map and directory","Building markers and location details","Proposed update and support service"]),
           ("PAIN RELIEVERS",["Verified names and entrances reduce ambiguity","Search helps narrow down unfamiliar locations","Offline support only if provider and testing allow it"]),
           ("GAIN CREATORS",["Clear destination details and visual references","Semesterly directory review and update workflow","Aggregate popular-search insights for admins"])]
    def panel(cols, items):
        x0=cols; y=205
        for head, lines in items:
            d.rounded_rectangle((x0,y,x0+750,y+230),radius=16,fill="white",outline=LINE,width=2)
            d.text((x0+24,y+18),head,font=font(20,True),fill=(143,87,0) if x0>900 else NAVY)
            yy=y+61
            for line in lines:
                d.ellipse((x0+28,yy+7,x0+38,yy+17),fill=YELLOW if x0>900 else (68,119,169))
                yy=draw_lines(d,(x0+52,yy),line,font(17),INK,660,3)+9
            y += 252
    panel(75,left); panel(950,right)
    im.save(path)

def make_sdg(path):
    data=[("SDG 4","QUALITY EDUCATION",(197,25,45)),("SDG 9","INDUSTRY & INNOVATION",(253,105,37)),("SDG 10","REDUCED INEQUALITIES",(221,19,103)),("SDG 11","SUSTAINABLE COMMUNITIES",(253,157,36))]
    im=Image.new("RGB",(1500,230),(255,255,255)); d=ImageDraw.Draw(im)
    x=10
    for n,label,c in data:
        d.rounded_rectangle((x,20,x+350,205),radius=18,fill=c)
        d.text((x+20,42),n,font=font(31,True),fill="white")
        y=100
        for line in wrap_text(d,label,font(17,True),305):
            d.text((x+20,y),line,font=font(17,True),fill="white"); y+=24
        x+=370
    im.save(path)

wire=os.path.join(TMP,"trail_it_wireframes.png")
vpc=os.path.join(TMP,"trail_it_value_canvas.png")
sdg=os.path.join(TMP,"sdg_labels.png")
make_wireframes(wire); make_vpc(vpc); make_sdg(sdg)

doc=Document(SRC)

def set_para(p, text):
    # Keep paragraph-level formatting while replacing its runs.
    for child in list(p._p):
        if child.tag != qn("w:pPr"):
            p._p.remove(child)
    p.add_run(text)

def find_para(prefix):
    for p in doc.paragraphs:
        if p.text.strip().startswith(prefix): return p
    raise ValueError("Paragraph not found: "+prefix)

def set_table_rows(table, rows, widths=None):
    while len(table.rows)<len(rows): table.add_row()
    while len(table.rows)>len(rows):
        tr=table.rows[-1]._tr; tr.getparent().remove(tr)
    for ri,row in enumerate(rows):
        for ci,val in enumerate(row):
            cell=table.cell(ri,ci); cell.text=str(val)
            cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
    table.alignment=WD_TABLE_ALIGNMENT.CENTER
    if widths:
        table.autofit=False
        for ci,width in enumerate(widths):
            table.columns[ci].width=Inches(width)
            for row in table.rows: row.cells[ci].width=Inches(width)

def trim_table_columns(table, target):
    for row in table.rows:
        while len(row.cells)>target:
            last=row._tr.tc_lst[-1]
            last.getparent().remove(last)
    grid=table._tbl.tblGrid
    while len(grid.gridCol_lst)>target:
        last=grid.gridCol_lst[-1]
        grid.remove(last)

def add_para_before(anchor, text, bold_lead=None):
    p=anchor.insert_paragraph_before()
    if bold_lead and text.startswith(bold_lead):
        p.add_run(bold_lead).bold=True; p.add_run(text[len(bold_lead):])
    else: p.add_run(text)
    return p

def add_image_before(anchor, path, width=6.25):
    p=anchor.insert_paragraph_before()
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path,width=Inches(width))
    return p

def add_table_before(anchor, rows, widths=None):
    t=doc.add_table(rows=0,cols=len(rows[0]))
    # Some supplied templates omit the built-in Table Grid style, so add borders directly.
    borders=OxmlElement("w:tblBorders")
    for edge in ("top","left","bottom","right","insideH","insideV"):
        el=OxmlElement("w:"+edge); el.set(qn("w:val"),"single"); el.set(qn("w:sz"),"5"); el.set(qn("w:color"),"D9DEE7"); borders.append(el)
    t._tbl.tblPr.append(borders)
    t.alignment=WD_TABLE_ALIGNMENT.CENTER
    for row in rows:
        cells=t.add_row().cells
        for i,val in enumerate(row):
            cells[i].text=str(val)
            cells[i].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if widths: cells[i].width=Inches(widths[i])
            if len(t.rows)==1:
                for run in cells[i].paragraphs[0].runs:
                    run.bold=True; run.font.color.rgb=RGBColor(255,255,255)
                tcPr=cells[i]._tc.get_or_add_tcPr(); shd=OxmlElement("w:shd"); shd.set(qn("w:fill"),"17315E"); tcPr.append(shd)
    anchor._p.addprevious(t._tbl)
    return t

# Cover page: retain university logo and content, improve hierarchy and alignment.
for p in doc.paragraphs[:38]:
    if not p.text.strip(): continue
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    if p.text.startswith("TRAIL-IT:"):
        for r in p.runs: r.bold=True; r.font.size=Pt(20); r.font.color.rgb=RGBColor(*NAVY)
    elif p.text.startswith("Group Name:") or p.text.startswith("ROQUE,"):
        for r in p.runs: r.font.size=Pt(12)
    elif p.text.startswith("December"):
        for r in p.runs: r.font.size=Pt(12)
set_para(find_para("ROQUE,SABAL,VELOSO,OSA,ALEGRADO"), "ROQUE, SABAL, VELOSO, OSA, ALEGRADO")

# Complete scope sentence; align offline capability with what can actually be delivered.
set_para(find_para("The project seeks to address campus navigation"),
         "The project focuses on campus navigation and access to location information. Building photographs, detailed facility descriptions, walking distances, and offline access are proposed enhancements for later versions, subject to campus data availability, provider terms, and technical testing.")
set_para(find_para("Offline Navigation, allows locating key interest"),
         "Evaluate offline access to key location information as a later feature, subject to map-provider terms and technical testing.")
set_para(find_para("Offline Navigation; Allows user to locate"),
         "Offline access to key location information may be considered for a later version, subject to provider terms and technical testing.")
set_para(find_para("To address this concern, TRAILERS designed and prototyped"),
         "To address this concern, the team developed initial TRAIL-IT concept wireframes for a digital campus navigation map. The proposed design uses a campus map, location markers, search, and basic destination information to help students find unfamiliar places. The wireframes are illustrative and require validation with students and USTP offices.")
set_para(find_para("Development will begin with a select group"),
         "Development will begin with selected buildings at USTP Cagayan de Oro rather than mapping every room and facility at once. This phased approach allows the team to evaluate usefulness, identify technical limitations, and gather feedback before considering expansion to other USTP campuses.")
set_para(find_para("However, general-purpose navigation applications do not necessarily provide"),
         "However, general-purpose navigation applications may not provide detailed information about internal university buildings, specific classrooms, departmental offices, or campus facilities. This creates an opportunity for a campus-focused system. TRAIL-IT will initially serve selected buildings at USTP Cagayan de Oro. The wider USTP System is a potential future expansion market, subject to university approval and campus data availability.")

# TAM/SAM/SOM: teacher's scope and figures, with a clear assumption note.
set_para(find_para("36,000 students"), "36,000+ students")
set_para(find_para("The total estimated student population"), "The estimated total student-user population across the USTP System; this is a long-term expansion market.")
sam=None
for p in doc.paragraphs:
    if p.text.strip()=="36,000 students": sam=p
if sam is None:
    # First one was changed above; locate value after SAM heading.
    ps=doc.paragraphs
    for i,p in enumerate(ps):
        if p.text.strip()=="Serviceable Available Market (SAM)": sam=ps[i+1]; break
set_para(sam, "12,000 students")
set_para(find_para("The estimated student population across the three campuses"), "The estimated student-user population at USTP Cagayan de Oro, the campus covered by the initial project scope.")
set_para(find_para("The SAM assumes that all three campuses"), "The TAM represents the wider USTP System opportunity if the product expands. The SAM is limited to USTP Cagayan de Oro for the initial pilot. Enrollment figures are planning estimates and should be checked against the latest official USTP enrollment data before deployment.")
set_para(find_para("The TAM represents the overall potential student market"), "Students are the intended users; the university administration is the proposed institutional buyer. Faculty, staff, and visitors may also use the system but are not included in these student estimates.")
set_para(find_para("For the initial projection, the project will use"), "For the initial CDO pilot, the team will use a planning target of 10% of the estimated 12,000-student serviceable market during the first academic year. This is a target assumption, not a measured adoption rate.")
set_para(find_para("\\[ SOM = 36,000"), "SOM = 12,000 × 10% = 1,200 students")
set_para(find_para("3,600 students"), "1,200 students")
set_para(find_para("10% of the estimated 36,000"), "10% of the estimated 12,000 CDO student population")
set_para(find_para("This means that the initial goal is to attract"), "The initial pilot goal is to reach approximately 1,200 student users at USTP Cagayan de Oro during the first academic year.")
# Remove the old embedded three-campus TAM equation between the TAM and SAM blocks.
tam_desc=find_para("The estimated total student-user population across the USTP System")
sam_head=find_para("Serviceable Available Market (SAM)")
node=tam_desc._p.getnext()
while node is not None and node is not sam_head._p:
    nxt=node.getnext()
    if node.tag==qn("w:p"):
        from docx.text.paragraph import Paragraph
        if not Paragraph(node,doc).text.strip(): node.getparent().remove(node)
    node=nxt

# Business model: CDO pilot first; recurring fee services made explicit.
set_para(find_para("Instead of immediately developing a complete campus navigation"), "Instead of immediately developing a system for all USTP campuses, the team will begin with a minimum viable product for selected buildings at USTP Cagayan de Oro.")
set_para(find_para("A proposed monthly subscription fee of ₱5,000"), "A proposed monthly campus license of ₱5,000 would cover continued access, technical maintenance, a semesterly review of room and office listings, approved campus event pins, correction requests, and aggregate reports on frequently searched locations. Search reporting should be aggregated and should not expose individual student activity. The fee is a planning assumption for discussion, not an approved university price.")
set_para(find_para("The projected first-year revenue is based on receiving"), "The initial projection below models one USTP Cagayan de Oro pilot campus for 12 months. A three-campus rollout is a future expansion scenario and is not treated as confirmed first-year revenue.")

# Revenue model table T13: make the initial projection one-campus.
revenue_table=doc.tables[13]
trim_table_columns(revenue_table,2)
set_table_rows(revenue_table,[
    ["Revenue source","One-campus CDO pilot"],
    ["One-time implementation fee","₱10,000"],
    ["Monthly campus license","₱5,000"],
    ["Annual recurring revenue (12 months)","₱60,000"],
    ["Illustrative first-year revenue","₱70,000"],
],widths=[4.55,1.85])

# Value proposition: fill the missing subsections with a graphic and prose.
iv_headings=[p for p in doc.paragraphs if p.text.strip()=="IV. BUSINESS MODELLING"]
set_para(iv_headings[-1], "VI. PROTOTYPE/DEVELOPMENT AND MINIMUM VIABLE PRODUCT")
iv_headings[-1].paragraph_format.page_break_before=True
p53=find_para("5.3 VALUE MAP")
p54=find_para("5.4 FIT BETWEEN CUSTOMER NEEDS")
p55=find_para("5.5 VALUE PROPOSITION STATEMENT")
p53.text="5.3 VALUE MAP"
add_para_before(p54,"The canvas below maps student needs to the proposed CDO pilot features. The map and route information remain subject to verification with the university.")
add_image_before(p54,vpc)
cap1=add_para_before(p54,"Figure 1. TRAIL-IT student value proposition canvas. The features are proposed and will be tested with users.")
cap1.alignment=WD_ALIGN_PARAGRAPH.CENTER
add_para_before(p54,"University administration value map: The proposed service gives the university a managed campus directory, a process for semesterly updates, correction handling, approved event pins, and aggregate search insights. Expected institutional gains include fewer repeated direction requests at guard posts or information desks and a more current digital campus image. These outcomes have not yet been measured.")
p54.text="5.4 FIT BETWEEN CUSTOMER NEEDS AND PROPOSED SOLUTION"
add_para_before(p55,"The initial fit is between students' difficulty finding unfamiliar destinations and a searchable, campus-specific map with verified names, entrances, and basic directions. For the university, the fit is a maintained digital directory and an update workflow. The first pilot should test destination-finding success, time to locate a place, information accuracy, and staff effort to update listings.")
p55.text="5.5 VALUE PROPOSITION STATEMENT"
add_para_before(find_para("VI. PROTOTYPE/DEVELOPMENT"),"For students at USTP Cagayan de Oro, TRAIL-IT is a proposed campus directory and navigation map that helps them search for unfamiliar buildings, offices, and facilities using verified location information. For university administrators, it offers a managed channel for maintaining campus location information and sharing approved updates. The value will be validated through a campus pilot before any system-wide rollout or license commitment.")

# Fix the mislabeled section and insert original concept wireframes in place of scraped captions.
raw=find_para("Inclusive Wayfinding App for University Campuses")
raw.text=""
raw.alignment=WD_ALIGN_PARAGRAPH.CENTER
raw.add_run().add_picture(wire,width=Inches(6.25))
raw2=find_para("University Map Application UI Design")
set_para(raw2,"Figure 2. TRAIL-IT low-fidelity wireframes created for this proposal. The campus layout and labels are illustrative placeholders pending verification.")
raw2.alignment=WD_ALIGN_PARAGRAPH.CENTER
for p in list(doc.paragraphs):
    if p.text.strip() in {"Indoor navigation application case study (Campus)","12"}:
        p._p.getparent().remove(p._p)

# Replace repeated survey analysis in Section 6.2 with a transparent usability-test plan.
heading=find_para("6.2 Market Validation and Customer Feedback")
docpara=list(doc.paragraphs)
next_heading=next(p for p in docpara if p.text.strip().startswith("6.3 Documentation"))
body=doc.element.body
start=heading._p.getnext()
while start is not None and start is not next_heading._p:
    nxt=start.getnext()
    if start.tag in (qn("w:p"),qn("w:tbl")):
        start.getparent().remove(start)
    start=nxt
heading.text="6.2 Prototype Usability Testing"
add_para_before(next_heading,"The initial survey findings and respondent tables are reported in Section 1.2. This section defines the usability test for the TRAIL-IT CDO wireframe/prototype so the team can assess whether users can complete common wayfinding tasks.")
add_para_before(next_heading,"Testing status: The usability test has not yet been conducted for this report. The following protocol is proposed; results should be recorded only after participants complete the tasks.")
add_para_before(next_heading,"Participants: Recruit 10–20 USTP Cagayan de Oro students, prioritizing freshmen, transferees, and students unfamiliar with the selected destinations. Record participant count and relevant experience without collecting unnecessary personal information.")
add_para_before(next_heading,"Procedure: Give each participant the same set of campus-location tasks using the prototype. Do not provide directions while the participant is attempting a task. Afterward, ask which information was unclear and whether the map or search results helped.")
add_table_before(next_heading,[
    ["Test task","What to record"],
    ["Find a selected building from the campus map.","Task completion; time; wrong turns or help needed."],
    ["Search for an office or facility by name.","Whether the correct result is selected; search clarity."],
    ["Open a destination and identify its entrance or room details.","Information accuracy; missing or confusing details."],
    ["Follow the proposed route to the destination.","Route comprehension; completion; map-data issues."],
])
add_para_before(next_heading,"Report the number of participants, task-completion rate, median completion time, errors, and recurring comments after testing. Do not interpret willingness-to-use survey answers as observed adoption or usability results.")

# Add specific university partners to data validation and approval plan.
set_para(find_para("The team will coordinate with university departments"), "The team will request data validation and approval from the relevant USTP offices, including the Physical Plant or Campus Planning office for building and entrance details, the Office of Student Affairs (OSA) for student-facing information, and the Center for Information Technology Services (CITS) for technical review. Confirm the current office names, responsibilities, and approval process with USTP before deployment. Department representatives may help review updates.")

# Clean copied image-source text and improve accessibility language.
for p in list(doc.paragraphs):
    t=p.text.strip()
    if t in {"UNITED NATIONS CONFERENCE CENTRE, BANGKOK | ESCAP","Sustainabililty","File:Sustainable Development Goal 11SustainableCities.svg - Wikimedia Commons","About Brightfields | Coaching & Leadership Experts"}:
        p._p.getparent().remove(p._p)
set_para(find_para("By making campus information more accessible"), "By making verified campus information easier to access, the application can support students and visitors who are unfamiliar with the university. The team will consider PWD-related information such as step-free entrances, ramps, elevators, and accessible routes only after these details are verified with the appropriate USTP office. Accessibility is a design goal; the current proposal does not claim that accessible routes have already been mapped or tested.")
# Insert a clean SDG label graphic before SDG 4.
sdg_anchor=find_para("SDG 4 – Quality Education")
add_image_before(sdg_anchor,sdg,width=6.2)
cap3=add_para_before(sdg_anchor,"Figure 3. Sustainable Development Goals relevant to the proposal.")
cap3.alignment=WD_ALIGN_PARAGRAPH.CENTER

# Financial assumptions: show map service, student-team allowance, and one-campus pilot economics.
finance_start=next(i for i,t in enumerate(doc.tables) if t.cell(0,0).text.strip()=="Startup expense")
trim_table_columns(doc.tables[finance_start],2)
set_table_rows(doc.tables[finance_start],[
    ["Startup expense","Estimated cost"],
    ["Student team allowance for prototype development (not commercial labor cost)","₱4,000"],
    ["Map and campus location data preparation","₱2,000"],
    ["Domain, hosting, and initial deployment","₱1,500"],
    ["Testing and quality assurance","₱1,000"],
    ["Initial promotional materials","₱500"],
    ["Contingency allowance","₱1,000"],
    ["Total estimated startup cost","₱10,000"],
],widths=[4.8,1.4])
ops=next(t for t in doc.tables if t.cell(0,0).text.strip()=="Expense")
trim_table_columns(ops,2)
set_table_rows(ops,[
    ["Expense","Monthly cost"],
    ["Map service and cloud infrastructure allowance (provisional)","₱2,000"],
    ["Maintenance and campus-directory updates","₱4,000"],
    ["Administrative and support expenses","₱1,500"],
    ["Marketing and communication","₱1,500"],
    ["Variable operating expenses","₱2,100"],
    ["Total monthly operating expenses","₱11,100"],
],widths=[4.8,1.4])
set_para(find_para("These figures are proposed budgeting assumptions"), "The ₱2,000 monthly map-service and cloud-infrastructure line is a provisional allowance, not a supplier quotation. It covers the planned map tile service and basic application hosting for a small pilot; actual costs depend on traffic, exchange rates, and the selected provider. MapTiler Cloud currently lists its Flex plan at US$30 per month, with extra traffic billed separately. The team should confirm provider terms and local peso pricing before deployment. Source: https://www.maptiler.com/cloud/pricing/ .")
find_para("Estimated monthly operating expenses").paragraph_format.page_break_before=True
set_para(find_para("The first-year projection also includes a one-time"), "For the one-campus CDO pilot, the first-year projection includes a ₱10,000 one-time implementation fee and ₱60,000 in recurring license revenue, for total projected revenue of ₱70,000.")
set_para(find_para("After deducting the estimated ₱133,200"), "After deducting estimated annual operating expenses of ₱133,200 and the ₱10,000 startup cost, the illustrative first-year result is:")
set_para(find_para("Illustrative first-year surplus"), "Illustrative first-year result (one-campus pilot)")
set_para(find_para("₱46,800"), "-₱73,200")
set_para(find_para("The projections assume that all three campuses"), "At the proposed ₱5,000 monthly license, one campus does not cover the estimated ₱11,100 monthly operating expenses. The pilot would therefore require institutional sponsorship or grant support while the team validates demand, refines costs, and tests a sustainable license price. A multi-campus rollout could improve revenue, but it is not confirmed and should be presented only as a future scenario.")
proj=next(t for t in doc.tables if t.cell(0,0).text.strip()=="Financial indicator")
trim_table_columns(proj,2)
set_table_rows(proj,[
    ["Financial indicator","CDO pilot"],
    ["Monthly campus license revenue","₱5,000"],
    ["Monthly operating expenses","₱11,100"],
    ["Illustrative monthly operating result","-₱6,100"],
    ["Annual recurring license revenue","₱60,000"],
    ["One-time implementation fee","₱10,000"],
    ["Total projected first-year revenue","₱70,000"],
    ["Annual operating expenses","₱133,200"],
    ["Startup cost","₱10,000"],
    ["Illustrative first-year result","-₱73,200"],
],widths=[4.8,1.4])
# Remove legacy embedded financial math and replace it with the corrected one-campus equation.
equation_anchor=find_para("Illustrative first-year result (one-campus pilot)")
node=equation_anchor._p.getprevious()
while node is not None and node.tag==qn("w:p"):
    from docx.text.paragraph import Paragraph
    prev=Paragraph(node,doc)
    if prev.text.strip(): break
    older=node.getprevious(); node.getparent().remove(node); node=older
equation_p=equation_anchor.insert_paragraph_before()
equation_p.alignment=WD_ALIGN_PARAGRAPH.CENTER
run=equation_p.add_run("₱70,000 - ₱133,200 - ₱10,000 = -₱73,200")
run.bold=True; run.font.size=Pt(13)

# Conclusion wording: remove any residual opening adverb and keep claims tied to the survey.
for p in doc.paragraphs:
    if p.text.strip().startswith("Inevitably"):
        set_para(p,p.text.strip().removeprefix("Inevitably "))

# Global document formatting and page numbers.
for p in doc.paragraphs:
    if not p.text.strip(): continue
    if p.style.name.startswith("Heading") or p.style.name in {"Title", "Subtitle", "List Paragraph"}:
        continue
    if p.text.strip().isupper() and len(p.text.strip())<90: continue
    if p.paragraph_format.page_break_before: continue
    p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
for table in doc.tables:
    table.alignment=WD_TABLE_ALIGNMENT.CENTER
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.alignment=WD_ALIGN_PARAGRAPH.LEFT

# Add centered page fields to every section footer. Keep the cover unnumbered.
for si,section in enumerate(doc.sections):
    pgtype=section._sectPr.find(qn("w:pgNumType"))
    if pgtype is not None: section._sectPr.remove(pgtype)
    section.footer.is_linked_to_previous=False
    fp=section.footer.paragraphs[0]
    fp.clear(); fp.alignment=WD_ALIGN_PARAGRAPH.CENTER
    fp.add_run("Page ")
    fld=OxmlElement("w:fldSimple"); fld.set(qn("w:instr"),"PAGE"); fp._p.append(fld)
    if si==0:
        section.different_first_page_header_footer=True
        section.first_page_footer.paragraphs[0].clear()

doc.core_properties.title="TRAIL-IT Campus Navigation Proposal"
doc.core_properties.subject="Revised technopreneurship report"
doc.save(OUT)
print(OUT)
