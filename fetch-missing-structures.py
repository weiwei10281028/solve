# -*- coding: utf-8 -*-
"""PubChem 2D MOL 批次下載 + 更新 index.json"""
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STRUCT_DIR = ROOT / "structures"
INDEX_PATH = STRUCT_DIR / "index.json"

# (query, id, label, formula, aliases)
TARGETS = [
    # 卤代甲烷
    ("CH4", "甲烷", "甲烷", "CH4", ["CH4", "ch4"]),
    ("CH3F", "氟甲烷", "氟甲烷", "CH3F", ["CH3F", "一氟甲烷"]),
    ("CH3Cl", "氯甲烷", "氯甲烷", "CH3Cl", ["CH3Cl", "一氯甲烷", "甲基氯"]),
    ("CH3Br", "溴甲烷", "溴甲烷", "CH3Br", ["CH3Br", "一溴甲烷"]),
    ("CH3I", "碘甲烷", "碘甲烷", "CH3I", ["CH3I", "一碘甲烷"]),
    ("CH2F2", "二氟甲烷", "二氟甲烷", "CH2F2", ["CH2F2"]),
    ("CH2Cl2", "二氯甲烷", "二氯甲烷", "CH2Cl2", ["CH2Cl2"]),
    ("CH2Br2", "二溴甲烷", "二溴甲烷", "CH2Br2", ["CH2Br2"]),
    ("CH2I2", "二碘甲烷", "二碘甲烷", "CH2I2", ["CH2I2"]),
    ("CHF3", "三氟甲烷", "三氟甲烷", "CHF3", ["CHF3"]),
    ("CHCl3", "三氯甲烷", "三氯甲烷", "CHCl3", ["CHCl3", "chcl3", "氯仿"]),
    ("CHBr3", "三溴甲烷", "三溴甲烷", "CHBr3", ["CHBr3"]),
    ("CHI3", "三碘甲烷", "三碘甲烷", "CHI3", ["CHI3"]),
    ("CF4", "四氟化碳", "四氟化碳", "CF4", ["CF4"]),
    ("CCl4", "四氯化碳", "四氯化碳", "CCl4", ["CCl4", "ccl4"]),
    ("CBr4", "四溴化碳", "四溴化碳", "CBr4", ["CBr4"]),
    ("CI4", "四碘化碳", "四碘化碳", "CI4", ["CI4"]),
    ("CH2FCl", "氟氯甲烷", "氟氯甲烷", "CH2FCl", ["CH2FCl"]),
    ("CHF2Cl", "二氟一氯甲烷", "二氟一氯甲烷", "CHF2Cl", ["CHF2Cl"]),
    ("CHFCl2", "一氟二氯甲烷", "一氟二氯甲烷", "CHFCl2", ["CHFCl2"]),
    ("CCl2F2", "二氯二氟甲烷", "二氯二氟甲烷", "CCl2F2", ["CCl2F2", "R-12"]),
    ("CCl3F", "三氯一氟甲烷", "三氯一氟甲烷", "CCl3F", ["CCl3F", "R-11"]),
    ("CHClF2", "一氯二氟甲烷", "一氯二氟甲烷", "CHClF2", ["CHClF2", "R-22"]),
    # 乙烷／乙烯卤代
    ("C2H6", "乙烷", "乙烷", "C2H6", ["C2H6"]),
    ("C2H5Cl", "氯乙烷", "氯乙烷", "C2H5Cl", ["C2H5Cl"]),
    ("C2H5Br", "溴乙烷", "溴乙烷", "C2H5Br", ["C2H5Br"]),
    ("C2H5I", "碘乙烷", "碘乙烷", "C2H5I", ["C2H5I"]),
    ("1,2-dichloroethane", "1,2-二氯乙烷", "1,2-二氯乙烷", "C2H4Cl2", ["C2H4Cl2", "1,2-二氯乙烷"]),
    ("1,1-dichloroethane", "1,1-二氯乙烷", "1,1-二氯乙烷", "C2H4Cl2", ["1,1-二氯乙烷"]),
    ("1,1,1-trichloroethane", "1,1,1-三氯乙烷", "1,1,1-三氯乙烷", "C2H3Cl3", ["C2H3Cl3"]),
    ("1,2-dichloroethene", "1,2-二氯乙烯", "1,2-二氯乙烯", "C2H2Cl2", ["1,2-二氯乙烯"]),
    ("1,1-dichloroethene", "1,1-二氯乙烯", "1,1-二氯乙烯", "C2H2Cl2", ["1,1-二氯乙烯"]),
    ("vinyl chloride", "氯乙烯", "氯乙烯", "C2H3Cl", ["C2H3Cl", "氯乙烯"]),
    ("C2F4", "四氟乙烯", "四氟乙烯", "C2F4", ["C2F4", "TFE"]),
    ("C2Cl4", "四氯乙烯", "四氯乙烯", "C2Cl4", ["C2Cl4"]),
    ("C2H2F2", "1,1-二氟乙烯", "1,1-二氟乙烯", "C2H2F2", ["C2H2F2"]),
    # 丙烷卤代
    ("C3H8", "丙烷", "丙烷", "C3H8", ["C3H8"]),
    ("1-chloropropane", "1-氯丙烷", "1-氯丙烷", "C3H7Cl", ["1-氯丙烷"]),
    ("2-chloropropane", "2-氯丙烷", "2-氯丙烷", "C3H7Cl", ["2-氯丙烷"]),
    ("1-bromopropane", "1-溴丙烷", "1-溴丙烷", "C3H7Br", ["1-溴丙烷"]),
    ("2-bromopropane", "2-溴丙烷", "2-溴丙烷", "C3H7Br", ["2-溴丙烷"]),
    # 常見無機／小分子
    ("PH3", "磷化氫", "磷化氫", "PH3", ["PH3"]),
    ("AsH3", "砷化氫", "砷化氫", "AsH3", ["AsH3"]),
    ("SiH4", "矽烷", "矽烷", "SiH4", ["SiH4", "SiH4"]),
    ("GeH4", "鍺烷", "鍺烷", "GeH4", ["GeH4"]),
    ("B2H6", "乙硼烷", "乙硼烷", "B2H6", ["B2H6"]),
    ("N2O", "一氧化二氮", "一氧化二氮", "N2O", ["N2O", "笑氣"]),
    ("NO", "一氧化氮", "一氧化氮", "NO", ["NO"]),
    ("NO2", "二氧化氮", "二氧化氮", "NO2", ["NO2"]),
    ("N2O3", "三氧化二氮", "三氧化二氮", "N2O3", ["N2O3"]),
    ("N2O5", "五氧化二氮", "五氧化二氮", "N2O5", ["N2O5"]),
    ("ClO2", "二氧化氯", "二氧化氯", "ClO2", ["ClO2"]),
    ("Cl2O", "一氧化二氯", "一氧化二氯", "Cl2O", ["Cl2O"]),
    ("HClO", "次氯酸", "次氯酸", "HClO", ["HClO"]),
    ("HClO4", "過氯酸", "過氯酸", "HClO4", ["HClO4"]),
    ("H2SO3", "亞硫酸", "亞硫酸", "H2SO3", ["H2SO3"]),
    ("H2SO4", "硫酸", "硫酸", "H2SO4", ["H2SO4"]),
    ("HNO2", "亞硝酸", "亞硝酸", "HNO2", ["HNO2"]),
    ("HNO3", "硝酸", "硝酸", "HNO3", ["HNO3"]),
    ("H3PO4", "磷酸", "磷酸", "H3PO4", ["H3PO4"]),
    ("H2CO3", "碳酸", "碳酸", "H2CO3", ["H2CO3"]),
    ("H2S2O3", "硫代硫酸", "硫代硫酸", "H2S2O3", ["H2S2O3"]),
    ("COCl2", "光氣", "光氣", "COCl2", ["COCl2", "碳醯氯"]),
    ("CS2", "二硫化碳", "二硫化碳", "CS2", ["CS2"]),
    ("CCl2O", "碳醯氯", "碳醯氯", "COCl2", ["COCl2"]),
    # 醇／醛／酮补充
    ("1-butanol", "1-丁醇", "1-丁醇", "C4H9OH", ["1-丁醇", "正丁醇"]),
    ("2-butanol", "2-丁醇", "2-丁醇", "C4H9OH", ["2-丁醇"]),
    ("tert-butanol", "第三丁醇", "第三丁醇", "C4H9OH", ["第三丁醇", "叔丁醇"]),
    ("1-pentanol", "1-戊醇", "1-戊醇", "C5H11OH", ["1-戊醇"]),
    ("cyclohexanol", "環己醇", "環己醇", "C6H11OH", ["環己醇"]),
    ("cyclohexanone", "環己酮", "環己酮", "C6H10O", ["環己酮"]),
    ("butanal", "丁醛", "丁醛", "C4H8O", ["丁醛"]),
    ("pentanal", "戊醛", "戊醛", "C5H10O", ["戊醛"]),
    ("2-butanone", "丁酮", "丁酮", "C4H8O", ["丁酮", "MEK"]),
    ("3-pentanone", "3-戊酮", "3-戊酮", "C5H10O", ["3-戊酮"]),
    ("formaldehyde", "甲醛", "甲醛", "CH2O", ["CH2O", "HCHO"]),
    ("phenol", "苯酚", "苯酚", "C6H5OH", ["苯酚"]),
    ("aniline", "苯胺", "苯胺", "C6H5NH2", ["苯胺"]),
    ("benzoic acid", "苯甲酸", "苯甲酸", "C7H6O2", ["苯甲酸"]),
    ("toluene", "甲苯", "甲苯", "C7H8", ["甲苯"]),
    ("styrene", "苯乙烯", "苯乙烯", "C8H8", ["苯乙烯"]),
    ("naphthalene", "萘", "萘", "C10H8", ["萘"]),
    # 羧酸
    ("propanoic acid", "丙酸", "丙酸", "C3H6O2", ["丙酸"]),
    ("butanoic acid", "丁酸", "丁酸", "C4H8O2", ["丁酸"]),
    ("pentanoic acid", "戊酸", "戊酸", "C5H10O2", ["戊酸"]),
    ("hexanoic acid", "己酸", "己酸", "C6H12O2", ["己酸"]),
    ("oxalic acid", "草酸", "草酸", "C2H2O4", ["草酸"]),
    ("malonic acid", "丙二酸", "丙二酸", "C3H4O4", ["丙二酸"]),
    ("succinic acid", "丁二酸", "丁二酸", "C4H6O4", ["丁二酸"]),
    ("adipic acid", "己二酸", "己二酸", "C6H10O4", ["己二酸"]),
    # 酯／醚
    ("methyl formate", "甲酸甲酯", "甲酸甲酯", "C2H4O2", ["甲酸甲酯"]),
    ("ethyl formate", "甲酸乙酯", "甲酸乙酯", "C3H6O2", ["甲酸乙酯"]),
    ("propyl acetate", "乙酸丙酯", "乙酸丙酯", "C5H10O2", ["乙酸丙酯"]),
    ("butyl acetate", "乙酸丁酯", "乙酸丁酯", "C6H12O2", ["乙酸丁酯"]),
    ("diethyl ether", "乙醚", "乙醚", "C4H10O", ["乙醚", "diethyl ether"]),
    ("tetrahydrofuran", "四氫呋喃", "四氫呋喃", "C4H8O", ["THF", "四氫呋喃"]),
    # 胺
    ("ethylamine", "乙胺", "乙胺", "C2H5NH2", ["乙胺"]),
    ("propylamine", "丙胺", "丙胺", "C3H7NH2", ["丙胺"]),
    ("aniline", "苯胺", "苯胺", "C6H5NH2", ["苯胺"]),
    ("pyridine", "吡啶", "吡啶", "C5H5N", ["吡啶"]),
    ("pyrrole", "吡咯", "吡咯", "C4H5N", ["吡咯"]),
    # 烯／炔
    ("propene", "丙烯", "丙烯", "C3H6", ["丙烯"]),
    ("1-butene", "1-丁烯", "1-丁烯", "C4H8", ["1-丁烯"]),
    ("2-butene", "2-丁烯", "2-丁烯", "C4H8", ["2-丁烯"]),
    ("1-pentene", "1-戊烯", "1-戊烯", "C5H10", ["1-戊烯"]),
    ("1-hexyne", "1-己炔", "1-己炔", "C6H10", ["1-己炔"]),
    ("propyne", "丙炔", "丙炔", "C3H4", ["丙炔", "甲基乙炔"]),
    # 环烷
    ("cyclopropane", "環丙烷", "環丙烷", "C3H6", ["環丙烷"]),
    ("cyclobutane", "環丁烷", "環丁烷", "C4H8", ["環丁烷"]),
    ("cyclopentane", "環戊烷", "環戊烷", "C5H10", ["環戊烷"]),
    ("cyclohexane", "環己烷", "環己烷", "C6H12", ["環己烷"]),
    ("methylcyclohexane", "甲基環己烷", "甲基環己烷", "C7H14", ["甲基環己烷"]),
    # 芳香衍生物
    ("chlorobenzene", "氯苯", "氯苯", "C6H5Cl", ["氯苯"]),
    ("bromobenzene", "溴苯", "溴苯", "C6H5Br", ["溴苯"]),
    ("nitrobenzene", "硝基苯", "硝基苯", "C6H5NO2", ["硝基苯"]),
    ("o-xylene", "鄰二甲苯", "鄰二甲苯", "C8H10", ["鄰二甲苯"]),
    ("m-xylene", "間二甲苯", "間二甲苯", "C8H10", ["間二甲苯"]),
    ("p-xylene", "對二甲苯", "對二甲苯", "C8H10", ["對二甲苯"]),
    ("o-dichlorobenzene", "鄰二氯苯", "鄰二氯苯", "C6H4Cl2", ["鄰二氯苯"]),
    ("m-dichlorobenzene", "間二氯苯", "間二氯苯", "C6H4Cl2", ["間二氯苯"]),
    ("p-dichlorobenzene", "對二氯苯", "對二氯苯", "C6H4Cl2", ["對二氯苯"]),
    ("phenylacetylene", "苯乙炔", "苯乙炔", "C8H6", ["苯乙炔"]),
    # 醣／生物分子
    ("sucrose", "蔗糖", "蔗糖", "C12H22O11", ["蔗糖"]),
    ("lactose", "乳糖", "乳糖", "C12H22O11", ["乳糖"]),
    ("maltose", "麥芽糖", "麥芽糖", "C12H22O11", ["麥芽糖"]),
    ("ribose", "核糖", "核糖", "C5H10O5", ["核糖"]),
    ("deoxyribose", "去氧核糖", "去氧核糖", "C5H10O4", ["去氧核糖"]),
    ("glycerol", "丙三醇", "丙三醇", "C3H8O3", ["甘油", "丙三醇"]),
    ("lactic acid", "乳酸", "乳酸", "C3H6O3", ["乳酸"]),
    ("citric acid", "檸檬酸", "檸檬酸", "C6H8O7", ["檸檬酸"]),
    ("urea", "尿素", "尿素", "CH4N2O", ["尿素", "(NH2)2CO"]),
    ("caffeine", "咖啡因", "咖啡因", "C8H10N4O2", ["咖啡因"]),
    # 聚合物单体
    ("isoprene", "異戊二烯", "異戊二烯", "C5H8", ["異戊二烯"]),
    ("acrylonitrile", "丙烯腈", "丙烯腈", "C3H3N", ["丙烯腈"]),
    ("vinyl acetate", "醋酸乙烯酯", "醋酸乙烯酯", "C4H6O2", ["醋酸乙烯酯"]),
    # 其他高中常考
    ("ozone", "臭氧", "臭氧", "O3", ["O3"]),
    ("hydrogen peroxide", "過氧化氫", "過氧化氫", "H2O2", ["H2O2"]),
    ("hydrazine", "聯氨", "聯氨", "N2H4", ["N2H4", "肼"]),
    ("hydrogen cyanide", "氰化氫", "氰化氫", "HCN", ["HCN"]),
    ("hydrogen fluoride", "氟化氫", "氟化氫", "HF", ["HF"]),
    ("hydrogen chloride", "氯化氫", "氯化氫", "HCl", ["HCl"]),
    ("hydrogen bromide", "溴化氫", "溴化氫", "HBr", ["HBr"]),
    ("hydrogen iodide", "碘化氫", "碘化氫", "HI", ["HI"]),
    ("silicon tetrachloride", "四氯化矽", "四氯化矽", "SiCl4", ["SiCl4"]),
    ("silicon tetrafluoride", "四氟化矽", "四氟化矽", "SiF4", ["SiF4"]),
    ("phosphorus trichloride", "三氯化磷", "三氯化磷", "PCl3", ["PCl3"]),
    ("phosphorus pentachloride", "五氯化磷", "五氯化磷", "PCl5", ["PCl5"]),
    ("phosphorus oxychloride", "三氯氧磷", "三氯氧磷", "POCl3", ["POCl3"]),
    ("sulfur dichloride", "二氯化硫", "二氯化硫", "SCl2", ["SCl2"]),
    ("disulfur dichloride", "二氯化二硫", "二氯化二硫", "S2Cl2", ["S2Cl2"]),
    ("thionyl chloride", "亞硫醯氯", "亞硫醯氯", "SOCl2", ["SOCl2"]),
    ("sulfuryl chloride", "硫醯氯", "硫醯氯", "SO2Cl2", ["SO2Cl2"]),
    ("nitrosyl chloride", "亞硝醯氯", "亞硝醯氯", "NOCl", ["NOCl"]),
    ("nitryl chloride", "硝醯氯", "硝醯氯", "NO2Cl", ["NO2Cl"]),
    ("carbon disulfide", "二硫化碳", "二硫化碳", "CS2", ["CS2"]),
    ("carbon tetrabromide", "四溴化碳", "四溴化碳", "CBr4", ["CBr4"]),
    ("iodoform", "三碘甲烷", "三碘甲烷", "CHI3", ["CHI3", "碘仿"]),
    ("bromoform", "三溴甲烷", "三溴甲烷", "CHBr3", ["CHBr3", "溴仿"]),
    ("chloroform", "三氯甲烷", "三氯甲烷", "CHCl3", ["CHCl3", "氯仿", "chloroform"]),
    ("difluoromethane", "二氟甲烷", "二氟甲烷", "CH2F2", ["CH2F2", "R-32"]),
    ("trifluoroiodomethane", "三氟碘甲烷", "三氟碘甲烷", "CF3I", ["CF3I"]),
    ("hexachloroethane", "六氯乙烷", "六氯乙烷", "C2Cl6", ["C2Cl6"]),
    ("tetrachloroethylene", "四氯乙烯", "四氯乙烯", "C2Cl4", ["C2Cl4"]),
    ("trichloroethylene", "三氯乙烯", "三氯乙烯", "C2HCl3", ["C2HCl3"]),
    ("1,1,2-trichloroethane", "1,1,2-三氯乙烷", "1,1,2-三氯乙烷", "C2H3Cl3", ["1,1,2-三氯乙烷"]),
    ("1,2-dibromoethane", "1,2-二溴乙烷", "1,2-二溴乙烷", "C2H4Br2", ["1,2-二溴乙烷"]),
    ("1-bromobutane", "1-溴丁烷", "1-溴丁烷", "C4H9Br", ["1-溴丁烷"]),
    ("2-bromobutane", "2-溴丁烷", "2-溴丁烷", "C4H9Br", ["2-溴丁烷"]),
    ("1-chlorobutane", "1-氯丁烷", "1-氯丁烷", "C4H9Cl", ["1-氯丁烷"]),
    ("2-chlorobutane", "2-氯丁烷", "2-氯丁烷", "C4H9Cl", ["2-氯丁烷"]),
    ("1-iodobutane", "1-碘丁烷", "1-碘丁烷", "C4H9I", ["1-碘丁烷"]),
    ("tert-butyl chloride", "第三丁基氯", "第三丁基氯", "C4H9Cl", ["第三丁基氯"]),
    ("isobutane", "異丁烷", "異丁烷", "C4H10", ["異丁烷"]),
    ("neopentane", "新戊烷", "新戊烷", "C5H12", ["新戊烷"]),
    ("isopentane", "異戊烷", "異戊烷", "C5H12", ["異戊烷"]),
    ("n-pentane", "正戊烷", "正戊烷", "C5H12", ["正戊烷"]),
    ("n-hexane", "正己烷", "正己烷", "C6H14", ["正己烷"]),
    ("n-heptane", "正庚烷", "正庚烷", "C7H16", ["正庚烷"]),
    ("n-octane", "正辛烷", "正辛烷", "C8H18", ["正辛烷"]),
]


def norm_key(s):
    return re.sub(r"[\s_\-（）()]", "", str(s or "")).lower()


def load_index():
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def known_keys(index_data):
    keys = set()
    ids = set()
    for e in index_data.get("entries", []):
        if e.get("id"):
            ids.add(e["id"])
        for k in [e.get("id"), e.get("label"), e.get("formula"), e.get("name_en"), e.get("common")]:
            if k:
                keys.add(norm_key(k))
        for a in e.get("aliases", []):
            if a:
                keys.add(norm_key(a))
    return keys, ids


def has_target(keys, ids, entry_id, formula, aliases):
    if entry_id in ids:
        return True
    for k in [entry_id, formula, *aliases]:
        if norm_key(k) in keys:
            return True
    return False


def pubchem_fetch_mol(query):
    q = urllib.parse.quote(str(query))
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{q}/record/SDF?record_type=2d"
    req = urllib.request.Request(url, headers={"User-Agent": "ChemTool/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    m = re.search(r"\nM  END\n", raw)
    if not m:
        raise ValueError("no MOL block")
    block = raw[: m.end()].strip()
    if not block.startswith("\n") and not re.match(r"\d", block):
        # strip sdf header lines before counts line
        lines = block.splitlines()
        for i, line in enumerate(lines):
            if re.match(r"^\s*\d+\s+\d+\s+", line):
                block = "\n".join(lines[i:]) + "\n"
                break
    if not block.endswith("\n"):
        block += "\n"
    return block


def safe_filename(entry_id):
    name = re.sub(r'[<>:"/\\|?*]', "_", entry_id)
    return f"{name}.mol"


def merge_entry(index_data, entry_id, label, formula, aliases, mol_text, query):
    fname = safe_filename(entry_id)
    fp = STRUCT_DIR / fname
    fp.write_text(mol_text, encoding="utf-8")
    alias_set = list(dict.fromkeys([entry_id, label, formula, *aliases]))
    new_entry = {
        "id": entry_id,
        "file": fname,
        "label": label,
        "name_en": formula if re.match(r"^[A-Za-z0-9()]+$", formula or "") else query,
        "formula": formula,
        "aliases": alias_set,
        "source": f"PubChem 2D（{query}）",
    }
    # update existing same id
    for i, e in enumerate(index_data["entries"]):
        if e.get("id") == entry_id:
            old_aliases = e.get("aliases") or []
            new_entry["aliases"] = list(dict.fromkeys([*old_aliases, *alias_set]))
            new_entry["file"] = e.get("file") or fname
            if (STRUCT_DIR / new_entry["file"]).is_file() and entry_id != e.get("id"):
                pass
            index_data["entries"][i] = {**e, **new_entry}
            return "update", new_entry["file"]
    index_data["entries"].append(new_entry)
    return "add", fname


def enrich_existing(index_data):
    """補齊既有條目別名（如 CHCl3 / 氯仿）"""
    changed = 0
    alias_map = {
        "三氯甲烷": ["CHCl3", "chcl3", "氯仿", "chloroform"],
        "四氯化碳": ["CCl4", "ccl4"],
        "四氟化碳": ["CF4", "cf4"],
        "二氯甲烷": ["CH2Cl2", "ch2cl2"],
        "氯甲烷": ["CH3Cl", "ch3cl"],
        "溴甲烷": ["CH3Br", "ch3br"],
        "碘甲烷": ["CH3I", "ch3i"],
        "三氟甲烷": ["CHF3", "chf3"],
        "三溴甲烷": ["CHBr3", "chbr3", "溴仿"],
        "三碘甲烷": ["CHI3", "chi3", "碘仿"],
        "氯化氫": ["HCl", "hcl"],
    }
    for e in index_data["entries"]:
        eid = e.get("id") or ""
        extra = alias_map.get(eid)
        if not extra:
            continue
        aliases = list(dict.fromkeys([*(e.get("aliases") or []), *extra]))
        if aliases != (e.get("aliases") or []):
            e["aliases"] = aliases
            changed += 1
    return changed


def main():
    index_data = load_index()
    keys, ids = known_keys(index_data)
    enrich_existing(index_data)
    keys, ids = known_keys(index_data)

    added = updated = skipped = failed = 0
    seen_ids = set()
    failures = []

    for query, entry_id, label, formula, aliases in TARGETS:
        if entry_id in seen_ids:
            continue
        seen_ids.add(entry_id)
        if has_target(keys, ids, entry_id, formula, aliases):
            skipped += 1
            continue
        try:
            mol = pubchem_fetch_mol(query)
            action, fname = merge_entry(index_data, entry_id, label, formula, aliases, mol, query)
            if action == "add":
                added += 1
                print(f"+ {entry_id} ({query})")
            else:
                updated += 1
                print(f"~ {entry_id} ({query})")
            keys.add(norm_key(entry_id))
            keys.add(norm_key(formula))
            for a in aliases:
                keys.add(norm_key(a))
            ids.add(entry_id)
        except Exception as ex:
            failed += 1
            failures.append((entry_id, query, str(ex)))
            print(f"! {entry_id} ({query}): {ex}")
        time.sleep(0.25)

    index_data["count"] = len(index_data["entries"])
    INDEX_PATH.write_text(json.dumps(index_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nDone: add={added} update={updated} skip={skipped} fail={failed} total={index_data['count']}")
    if failures:
        print("Failures:", failures[:20])


if __name__ == "__main__":
    main()
