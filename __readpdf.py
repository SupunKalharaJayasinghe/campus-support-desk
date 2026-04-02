import sys 
sys.stdout.reconfigure(encoding='utf-8') 
from pathlib import Path 
import pypdf 
pdf = Path(r'c:\Users\kalha\Downloads\my-part.pdf') 
print('EXISTS', pdf.exists()) 
reader = pypdf.PdfReader(str(pdf)) 
print('PAGES', len(reader.pages)) 
for i, page in enumerate(reader.pages[:8]): 
    text = (page.extract_text() or '')[:5000] 
    print(f'--- PAGE {i+1} ---') 
    print(text)
