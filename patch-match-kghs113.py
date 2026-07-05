# -*- coding: utf-8 -*-
"""更新 kghs-113(2)-g2-t1.md 各題 MATCH（含題幹中文關鍵字）"""
import re
from pathlib import Path

PATH = Path(__file__).resolve().parent / 'database' / 'kghs-113(2)-g2-t1.md'

MATCH_BY_Q = {
    '1': '氯化鈉晶體,氯離子最近鄰,鈉離子配位數,面心立方,同電荷12,配位數6,離子晶體結構,距離氯離子,距離鈉離子',
    '2': '共價性程度,電負度差,離子鍵共價性,化學鍵結,共價性較高,KF,NaCl,LiBr,NaF,KBr,氟化鉀,氯化鈉,溴化鋰,氟化鈉,溴化鉀',
    '3': '鍵長最短,單鍵雙鍵三鍵,氫氣鍵長,碳碳鍵,H-H,C-C,C=C,C≡C,C=O,乙炔三鍵',
    '4': '氫分子位能圖,兩原子核距離,位能最低點,鍵長,共價半徑,鍵解離能,437kJ/mol,0.74,Cl2鍵能',
    '5': '熔點比較,晶格能,CaO,BaO,NaCl,KBr,LiCl,金屬鍵,Li,Na,K,Mg,Al,離子半徑',
    '6': '粒子半徑比較,陰離子半徑,同電子數,F-,Na+,S2-,Cl-,S,Se,C,B,Cr2+,Cr3+',
    '7': '游離能比較,離子半徑,電負度,原子半徑,Sr,Ca,Mg,Cl-,S2-,P3-,Br,Cl,F,Na,Mg,Al',
    '8': '游離能敘述,第二游離能,同族游離能,同週期游離能,吸熱,放熱,Mg2+,Na+,Ne,F-,等電子體',
    '9': 'F,Cl,F-,Cl-,游離能順序,陰離子游離能,電子親和力,中性大於陰離子',
    '10': 'Cl-游離能,Cl第一游離能,Cl第二游離能,電子親和力,ΔH1,ΔH2,ΔH3,ΔH4,逆反應',
    '11': '八隅體規則,奇數價電子,不符合八隅體,CO,NO,N2O4,PCl3,PF5,SF6,BeH2,H2O2,OF2',
    '12': '孤對電子最少,孤電子對,HCN,OCl2,CO,N2H2,HF,路易斯結構',
    '13': '硫氧鍵能,硫－氧鍵,SO3,SO2,SO32-,SO42-,平均鍵級,共振',
    '14': 'HCl,1s,3p,重疊,鍵結軌域,sp2混成,平面三角,CF4,NF3,BF3,SO3,NH3,三角錐',
    '15': 'σ鍵,π鍵,頭對頭,側向重疊,σ較強,多鍵,反式,二氯,丁烯,2,3-二氯-2-丁烯',
    '16': '鍵角,120度,最接近120,H2O,NCl3,BF3,CO2,CH4,3+0,3+1',
    '17': '維生素C,抗壞血酸,C6H8O6,sp2混成,sp3混成,環內氧,混成軌域',
    '18': '乙烷,乙烯,乙炔,鍵角,σ鍵,π鍵,混成,sp2-sp2,平面分子,直線分子',
    '19': '離子晶體性質,庫侖力,離子鍵方向性,導電,溶於水,熔點,離子半徑,電荷',
    '20': '能階高低,價軌域,內層軌域,He,H,O,N,B,Al,Na,2s,2p',
    '21': '電子組態,游離能順序,半徑,第二游離能,第三游離能,甲,乙,丙,丁,戊,己,4s1,激發態',
    '22': '游離能突躍,第一游離能,第二游離能,738,1451,7733,10540,鹼土金屬,ns2,MO,鹼性氧化物',
    '23': '平面分子,屬於平面分子,哪些平面,三氯化磷,三氟化硼,三氧化硫,乙醇,乙烯,PCl3,BF3,SO3,三角錐,立體,3+0,3+1,sp2,sp3',
    '24': '鍵長比較,鍵級,原子半徑,CO2,CO,F2,Cl2,O3,O2,HF,HCl,N2,鍵長大小',
    '25': '丙二烯,H2C=C=CH2,allene,sp,sp2,π鍵,p軌域,C-C-C,180度,直線形',
    '26': '石墨,金剛石,苯,乙烯,乙炔,混成種類,鍵長,鍵級,鍵能,sp3,sp2,sp',
    '27': '奇數價電子,配位共價鍵,鍵結形成,NH2,N2H4,NO2,N2O4,NH3,H+,CH4,OH,安定物種',
    '28': 'O3,SO2,臭氧,二氧化硫,共振結構,π鍵,角形,角錐,sp2混成,未鍵結電子',
}

NONSEL = {
    '1': '共振結構,中心原子孤對,中心孤對,NO3-,NO2-,SO42-,CO2,N2F2,N2H4,N2O4,HCN,H3O+,C6H6,苯,代號',
    '2': '路易斯結構,分子形狀,離子形狀,BF3,CO32-,PCl3,BF4-,BeCl2,HCN,NO2,混成,畫出',
    '3': '氯化鈉晶格能,晶格能,Born-Haber,玻恩哈伯,ΔH1,ΔH2,ΔH3,ΔH4,ΔH5,NaCl(s)',
}

text = PATH.read_text(encoding='utf-8')

for q, kw in MATCH_BY_Q.items():
    pat = rf'(### 第 {q} 題\n)<!-- MATCH: [^-]+-->'
    rep = rf'\1<!-- MATCH: {kw} -->'
    text, n = re.subn(pat, rep, text, count=1)
    if not n:
        print(f'warn: Q{q} not patched')

for key, kw in NONSEL.items():
    pat = rf'(### 非選 第 {key} 題\n)<!-- MATCH: [^-]+-->'
    text, n = re.subn(pat, rf'\1<!-- MATCH: {kw} -->', text, count=1)
    if not n:
        print(f'warn: 非選{key} not patched')

# frontmatter match_keywords 補中文
text = re.sub(
    r'match_keywords: \[[^\]]+\]',
    'match_keywords: ["平面分子", "三氯化磷", "三氟化硼", "三氧化硫", "乙醇", "乙烯", "共振結構", "路易斯結構", "分子形狀", "游離能", "八隅體", "混成軌域", "晶格能", "Born-Haber", "雄女113高二", "板書詳解", "NOTE標註", "htmlData", "MOL"]',
    text,
    count=1
)

PATH.write_text(text, encoding='utf-8')
print('done')
