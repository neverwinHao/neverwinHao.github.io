#!/usr/bin/env python3
"""Adapt the supplied TestExplora cover using current project-page identities.

Requires python-pptx and BeautifulSoup. The source template lives one directory
above the site checkout. Render the resulting cover PPTX to a 1600x900 PNG before
recording so the web cover and native PowerPoint use the same artwork.
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'neverwinHao.github.io/DPIAgent/assets/demo'
html=BeautifulSoup((ROOT/'neverwinHao.github.io/DPIAgent/index.html').read_text(),'html.parser')
prs=Presentation(ROOT/'TestExplora-Pre.pptx')
for sid in list(prs.slides._sldIdLst)[1:]:
 prs.part.drop_rel(sid.rId);prs.slides._sldIdLst.remove(sid)
s=prs.slides[0];shapes=list(s.shapes)
# Keep the template's layout, rule and title/author boxes. Replace source identities.
for i in [1,4,7,8]:
 e=shapes[i]._element;e.getparent().remove(e)
title=shapes[3];title.text_frame.paragraphs[0].runs[0].text=html.select_one('.paper-title').get_text()
# Match the original two-line centered title, avoiding font substitution reflow.
for p in title.text_frame.paragraphs:
 p.alignment=PP_ALIGN.CENTER
 for r in p.runs:r.font.name='Arial';r.font.size=Pt(32)
auth=shapes[2];tf=auth.text_frame;tf.clear();tf.word_wrap=False
names=html.select('.author-line > span')
for row,group in enumerate([names[:6],names[6:]]):
 p=tf.paragraphs[0] if row==0 else tf.add_paragraph();p.alignment=PP_ALIGN.CENTER;p.space_after=Pt(10)
 for i,name in enumerate(group):
  sup=name.find('sup');label=name.get_text().removesuffix(sup.get_text())
  r=p.add_run();r.text=(', ' if i else '')+label;r.font.name='Arial';r.font.size=Pt(18);r.font.color.rgb=RGBColor.from_string('444444')
  r=p.add_run();r.text=sup.get_text();r.font.name='Arial';r.font.size=Pt(18);r.font.color.rgb=RGBColor.from_string('444444');r._r.get_or_add_rPr().set('baseline','30000')
auth.top=Inches(4.6);auth.height=Inches(.85)
units=shapes[5];tf=units.text_frame;tf.clear();units.top=Inches(5.8);units.height=Inches(1)
for i,(num,label) in enumerate([('1','Microsoft'),('2','Tsinghua University')]):
 p=tf.paragraphs[0] if i==0 else tf.add_paragraph();p.alignment=PP_ALIGN.CENTER;p.space_after=Pt(10)
 r=p.add_run();r.text=num;r.font.name='Arial';r.font.size=Pt(20);r._r.get_or_add_rPr().set('baseline','30000')
 r=p.add_run();r.text=' '+label;r.font.name='Arial';r.font.size=Pt(20)
# Reuse the two matching affiliation logos from the original slide.
for sh,x,y in [(shapes[6],7.40,5.79),(shapes[9],8.2,6.24)]:sh.left=Inches(x);sh.top=Inches(y);sh.width=sh.height=Inches(.34)
venue=s.shapes.add_textbox(Inches(9.5),Inches(.35),Inches(2.9),Inches(.6))
p=venue.text_frame.paragraphs[0];p.text=html.select_one('.conference-venue').get_text();p.alignment=PP_ALIGN.RIGHT;p.font.name='Arial';p.font.size=Pt(30);p.font.bold=True
s.notes_slide.notes_text_frame.text='Cover adapted directly from TestExplora-Pre.pptx. Title, author order, affiliations and venue from the current DPIAgent project page.'
prs.core_properties.title=html.select_one('.paper-title').get_text();prs.core_properties.author='DPIAgent'
prs.save(ASSETS/'dpiagent-cover.pptx')
print('Saved cover',ASSETS/'dpiagent-cover.pptx')
