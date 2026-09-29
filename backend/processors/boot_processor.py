"""
Bootloader Excel 处理器。

从 AutoTool.py 第 5801-6373 行提取的 BTExcelProcessor 类，
移除 Qt 依赖（messagebox 调用替换为 logger / raise Exception），
保持核心 Excel 处理逻辑不变。
"""

import os
import sys
import ast
import re
import logging

from collections import Counter

import pandas as pd

# 确保项目根目录在 sys.path 中
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.utils.helpers import isnotna, return_str

logger = logging.getLogger(__name__)


class BTExcelProcessor:
    """Bootloader Excel 处理器

    解析 Bootloader 配置 Excel，生成 UDS_Main_info.ini 和 Struct.can 文件。
    所有 messagebox（Qt 弹窗）调用已替换为 logger / raise Exception。
    """

    def __init__(self, excel_file):
        self.excel_file = excel_file
        self.sheetnames = pd.ExcelFile(self.excel_file).sheet_names
        self.Other = {}
        self.sheets = {}
        self.UDS_Main_info = ''
        self.Serve = {}
        self.struct = '''
/*@!Encoding:936*/
includes
{
  
}

variables
{
  /*服务(新 ,参照配置表) * 结构体*/
  struct Serve_Support
  {
    byte Serve;                            /*服务*/
    dword Serve_Fun[50];                  /*服务支持的子功能*/ 
    byte Serve_Fun_Count;                  /*服务支持的子功能个数*/
    byte Serve_Fun_Len[50];               /*服务支持的子功能对应的正确长度*/ 
    
    byte Serve_Para[50][10];             /*每个子功能对应的参数*/ 
    byte Serve_Para_Count[50];            /*每个子功能对应的参数个数*/ 
    byte Serve_Para_Len[50][10];         /*子功能对应的每个参数的长度*/
    
    byte Serve_NRC[50][10];              /*NRC优先级(由高到低)*//*与子功能位置顺序对应*/
    byte Serve_NRC_Count[50];             /*NRC个数*/
    byte Serve_NRC22[50];                 /*NRC22条件*/
    byte RSP[50];                         /*肯定响应抑制位 1:支持  0:不支持*//*与子功能位置顺序对应*/
    byte Security_Access[50];             /*是否需要安全访问*//*与子功能位置顺序对应*/
    byte Serve_Addres[50];                /*寻址方式*//*与子功能位置顺序对应*/
    byte Serve_Session[50];               /*会话*//*与子功能位置顺序对应*/
  };
  struct Serve_Support Serve_Data[15];
  dword Serve_Data_Count;
  
  
  /*31服务(新 ,参照配置表) * 结构体*/
  /*1字节服务 + 1字节例程控制类型 + 2字节例程DID + 例程控制选项   例如 ：长安角度置零请求31 01 FE E0 01*/
  
  struct Serve_31_Support
  {   
    byte Routine[2];                      /*例程DID/进程号(一个例程2个byte)*/
    byte Routine_Len;                     /*例程对应的发送长度*/
    char Interpretation[50];              /*例程释义*/
    
    byte Control_Type_Count;              /*对应例程下有几个控制类型(和例程位置对应)*/
    byte Control_Type[10];                /*例程控制类型*//*和例程位置对应(一个例程多种控制类型(控制类型1byte))*/
    byte Control_Type_TxLen[10];            /*根据控制类型,例程对应的发送长度*/
    byte Control_Type_RxLen[10];          /*控制类型的响应长度*//*跟随控制类型*/
    int Control_Type_Success[10];         /*跟随控制类型,成功对应的数据*/
    int Control_Type_Failed[10];          /*跟随控制类型,失败对应的数据*/    
    int Control_Type_Others[10];          /*跟随控制类型,其他对应的数据*/

    
    byte Control_Option_Count[10];        /*对应例程下有几个控制选项(和控制类型对应)*/
    byte Control_Option[10][10];          /*例程控制选项*//*和控制类型对应(多种控制选项或没有控制选项 控制选项1byte)*/
    
    byte Security_Access[10];             /*是否需要安全访问(和控制类型对应)*/
    byte Serve_Addres[10];                /*支持的寻址方式(和控制类型对应)*/
    byte Serve_Session[10];               /*支持的会话(和控制类型对应)*/
    byte Serve_NRC22[10];                 /*NRC22条件(和控制类型对应)*/
    byte Serve_NRC[10];                   /*31服务下的NRC(和控制类型对应)*/
    byte Serve_NRC_Count[10];             /*31服务下的NRC个数(和控制类型对应)*/
    
  };
  struct Serve_31_Support Serve_31_Hex[10];
  dword Serve_31_Hex_Count;
  
}

void _Init_Struct()
{
  int i,n;
  dword Poss,Serve_Para,Serve_Fun;
  dword Rountine_Poss,Con_Poss;
  writeEx(-3,1,"------------初始化结构体---------------");
  
'''

    def _load_excel_sheets(self, name):
        """统一加载所有Excel表"""
        try:
            return pd.read_excel(self.excel_file, sheet_name=name)
        except Exception as e:
            logger.error(f"读取Excel失败: {str(e)}, sheet: {name}")
            raise RuntimeError(f"读取Excel失败: {str(e)}, sheet: {name}") from e

    def _save_file(self):
        """统一保存文件"""
        ini_file_path = os.path.dirname(self.excel_file) + "/BT_UDS_Main_info.ini"
        struct_file_path = os.path.dirname(self.excel_file) + "/Struct.can"
        try:
            with open(ini_file_path, 'w', encoding='utf-8') as f:
                f.write(self.UDS_Main_info)
            with open(struct_file_path, 'w', encoding='gbk') as f:
                f.write(self.struct + '\n}')
        except Exception as e:
            logger.error(f"文件保存失败：{str(e)}")
            raise RuntimeError(f"文件保存失败：{str(e)}") from e

    def process_Other(self):
        """处理other配置表"""
        sheetname = 'Other'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        self.Other = sheet.set_index('Symbol')['Value'].to_dict()
        columns = sheet.columns.tolist()
        for _, row in sheet.iterrows():
            if pd.notna(row[columns[0]]):
                if _ == 0:
                    self.UDS_Main_info += '#' + '******************************{group}******************************#\n'.format(group=row[columns[0]])
                else:
                    self.UDS_Main_info += '\n\n#' + '******************************{group}******************************#\n'.format(group=row[columns[0]])
            if pd.notna(row[columns[1]]):
                if pd.notna(row[columns[4]]):
                    self.UDS_Main_info += "\n#{comment}\n".format(comment=row[columns[4]])
                if 'ECU_project' in row[columns[1]]:
                    self.UDS_Main_info += "[Project_Information]\n"
                    self.UDS_Main_info += "{Var} = {Value}\n".format(Var=row[columns[1]], Value=str(row[columns[2]]).replace('\n', ''))
                    self.UDS_Main_info += "[{}]\n".format(row[columns[2]])
                else:
                    self.UDS_Main_info += "{Var} = {Value}\n".format(Var=row[columns[1]], Value=row[columns[2]])

    def process_31H(self):
        """处理31H配置表"""
        sheetname = '31H'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        #0          1       2           3           4           5           6           7                   8                   9                   10              11          12              13          14              15              16                17          
        columns = ["进程号", "描述", "例程控制类型", "例程控制选项", "发送长度", "响应长度", "安全访问", "默认模式\n物理寻址", "扩展模式\n物理寻址", "默认模式\n功能寻址", "扩展模式\n功能寻址", "NRC优先级", "NRC22的条件", "例程状态成功", "例程状态失败", "例程状态其他", "编程模式\n物理寻址", "编程模式\n功能寻址"]

        structCode = ""
        course_dict = {}
        current_process = None
        Current_RID = 0
        for _, row in sheet.iterrows():
            if pd.notna(row[0]):
                current_process = str(row[0])
                if current_process not in course_dict:
                    course_dict[current_process] = {
                        "Pos": Current_RID,
                        "例程控制类型": {}
                    }
                    Current_RID += 1
            routine_type = row[2]
            routine_option = row[3] if pd.notna(row[3]) and row[3] != "/" else ""

            if routine_type not in course_dict[current_process]["例程控制类型"]:
                course_dict[current_process]["例程控制类型"][routine_type] = {
                    "例程控制选项个数": 0,
                    "例程控制选项列表": []
                }
            if routine_option != "":
                course_dict[current_process]["例程控制类型"][routine_type]["例程控制选项个数"] += 1
                course_dict[current_process]["例程控制类型"][routine_type]["例程控制选项列表"].append(routine_option)

        for _, row in sheet.iterrows():
            Addres = 0
            Session = 0
            if (pd.notna(row[columns[7]]) and (row[columns[7]] == 1 or row[columns[7]] == '1')) or (pd.notna(row[columns[8]]) and (row[columns[8]] == 1 or row[columns[8]] == '1')) or (pd.notna(row[columns[16]]) and (row[columns[16]] == 1 or row[columns[16]] == '1')):
                Addres |= (1)
            if (pd.notna(row[columns[9]]) and (row[columns[9]] == 1 or row[columns[9]] == '1')) or (pd.notna(row[columns[10]]) and (row[columns[10]] == 1 or row[columns[10]] == '1')) or (pd.notna(row[columns[17]]) and (row[columns[17]] == 1 or row[columns[17]] == '1')):
                Addres |= (1 << 1)
            if (pd.notna(row[columns[8]]) and (row[columns[8]] == 1 or row[columns[8]] == '1')) or (pd.notna(row[columns[10]]) and (row[columns[10]] == 1 or row[columns[10]] == '1')):
                Session |= (1 << 2)
            if (pd.notna(row[columns[16]]) and (row[columns[16]] == 1 or row[columns[16]] == '1')) or (pd.notna(row[columns[17]]) and (row[columns[17]] == 1 or row[columns[17]] == '1')):
                Session |= (1 << 1)
            if (pd.notna(row[columns[9]]) and (row[columns[9]] == 1 or row[columns[9]] == '1')) or (pd.notna(row[columns[7]]) and (row[columns[7]] == 1 or row[columns[7]] == '1')):
                Session |= 1
            if pd.notna(row[columns[0]]):
                self.UDS_Main_info += '''
{} = {{0x31,{},0x{},0x{}{}}}'''.format(row[columns[1]], row[columns[2]], str(row[columns[0]])[2:], str(row[columns[0]])[:2], ',{}'.format(row[columns[3]]) if pd.notna(row[columns[3]]) and row[columns[3]] != '/' else '')
                course = str(row[columns[0]])
                _RID_31 = course.replace("0x" or "0X", "")
                _RID_31 = '0000'[:4 - len(_RID_31)] + _RID_31
                Control_Type_list = {'Control_Type': [],
                                     'Control_Option': []}
                structCode += '''
           
   /********************0x31 结构体*****************/     
   Serve_31_Hex[{Poss}].Routine[0]               = 0x{Serve_Fun1};            
   Serve_31_Hex[{Poss}].Routine[1]               = 0x{Serve_Fun2};                 
   Serve_31_Hex[{Poss}].Control_Type_Count       = {Fun_Count};
   '''.format(Serve_Fun1=_RID_31[:-2], Serve_Fun2=_RID_31[-2:],
             Poss=course_dict[course]['Pos'], Fun_Count=len(course_dict[course]['例程控制类型'])
            )
                if pd.notna(row[columns[11]]):
                    NRC_list = ast.literal_eval(row[columns[11]])
                    for _NRC, NRC in enumerate(NRC_list):
                        structCode += '''
   Serve_31_Hex[{Poss}].Serve_NRC[{index}]             = {NRCCode};'''.format(Poss=course_dict[course]['Pos'], index=_NRC, NRCCode="0x{:X}".format(NRC))

                if pd.notna(row[columns[2]]) and row[columns[2]] not in Control_Type_list['Control_Type']:
                    Control_Type_list['Control_Type'].append(row[columns[2]])
                    structCode += '''
   
   Serve_31_Hex[{Poss}].Control_Type[{structDIIndex}]          = {Control_Type};
   Serve_31_Hex[{Poss}].Control_Type_TxLen[{structDIIndex}]    = {Control_Type_TxLen};
   Serve_31_Hex[{Poss}].Serve_Addres[{structDIIndex}]          = {Serve_Addres};
   Serve_31_Hex[{Poss}].Serve_Session[{structDIIndex}]         = {Serve_Session};
   Serve_31_Hex[{Poss}].Security_Access[{structDIIndex}]       = {SSecurity_Access};
   Serve_31_Hex[{Poss}].Control_Option_Count[{structDIIndex}]  = {Control_Option_Count}; 
   Serve_31_Hex[{Poss}].Serve_NRC_Count[{structDIIndex}]       = {structDIDNRC_Count}; 
   Serve_31_Hex[{Poss}].Serve_NRC22[{structDIIndex}]           = {Serve_NRC22};
    '''.format(
                        Poss=course_dict[course]['Pos'],
                        structDIIndex=list(course_dict[course]['例程控制类型'].keys()).index(row[columns[2]]),
                        Control_Type=row[columns[2]],
                        Control_Type_TxLen=row[columns[4]],
                        Serve_Addres=Addres, Serve_Session=Session,
                        structDIDNRC_Count=len(NRC_list) if pd.notna(row[columns[11]]) and (row[columns[11]] != '/') else 0,
                        Control_Option_Count=course_dict[course]['例程控制类型'][row[columns[2]]]['例程控制选项个数'],
                        SSecurity_Access=str(int(row[columns[6]])) if pd.notna(row[columns[6]]) and row[columns[6]] != '/' else 0,
                        Serve_NRC22=int(row[columns[12]]) if pd.notna(row[columns[12]]) and row[columns[6]] != '/' else 0)

                if pd.notna(row[columns[3]]) and row[columns[3]] != '/':
                    Control_Type_list['Control_Option'].append(row[columns[3]])
                    structCode += '''
   Serve_31_Hex[{Poss}].Control_Option[{structDIIndex}][{index}]     = {Control_Option};'''.format(Poss=course_dict[course]['Pos'], structDIIndex=list(course_dict[course]['例程控制类型'].keys()).index(row[columns[2]]),
                                                                                                     index=course_dict[course]['例程控制类型'][row[columns[2]]]['例程控制选项列表'].index(row[columns[3]]), Control_Option=row[columns[3]])

        return (structCode + "\n  ", Current_RID)

    def process_2E_H(self, Poss, NRC22, Rsp, Addres, Session):
        """处理2E_H配置表"""
        sheetname = '2E_H'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        columns = ['DID号', 'DID描述', '是否需安全访问', '正常发送字节数', 'NRC', '结构体', 'INI']
        iniDID = []
        structDID = []
        structCode = ""
        DID_Temp = ''
        for _, row in sheet.iterrows():
            DID_Temp = str(row['DID号']).replace('0x', '').replace('0X', '').replace('.0', '')
            if (len(DID_Temp) < 4):
                DID_Temp = ('0000'[:(4 - len(DID_Temp))]) + str(DID_Temp)

            if row['INI'] == 1 or row['INI'] == '1':
                iniDID.append(row['DID号'])
            if row['结构体'] == 1 or row['结构体'] == '1':
                structDID.append(row['DID号'])
                structCode += '''
                
  Serve_Data[{Poss}].Serve_Fun[{structDIIndex}]         = {Serve_Fun};
  Serve_Data[{Poss}].Serve_Fun_Len[{structDIIndex}]     = {Serve_Fun_Len};
  Serve_Data[{Poss}].Serve_Addres[{structDIIndex}]      = {Serve_Addres};
  Serve_Data[{Poss}].Serve_Session[{structDIIndex}]     = {Serve_Session};
  Serve_Data[{Poss}].Serve_NRC_Count[{structDIIndex}]   = {structDIDNRC_Count};
  Serve_Data[{Poss}].Security_Access[{structDIIndex}]   = {SSecurity_Access};
  Serve_Data[{Poss}].Serve_NRC22[{structDIIndex}]       = {Serve_NRC22};'''.format(Poss=Poss, structDIIndex=_,
                                                                                       Serve_Fun='0x' + DID_Temp,
                                                                                       Serve_Addres=Addres, Serve_Session=Session,
                                                                                       structDIDNRC_Count=len(ast.literal_eval(row['NRC'])) if pd.notna(row['NRC']) else 0,
                                                                                       SSecurity_Access=row['是否需安全访问'] if pd.notna(row['是否需安全访问']) and row['是否需安全访问'] != '/' else 0,
                                                                                       Serve_NRC22=int(NRC22) if pd.notna(NRC22) else 0,
                                                                                       Serve_Fun_Len=str(row[columns[3]]).replace('/', '0').replace('.0', '').replace('nan', '0')
                                                                                       )
                if pd.notna(row['NRC']):
                    for _NRC, NRC in enumerate(ast.literal_eval(row['NRC'])):
                        structCode += '''
  Serve_Data[{Poss}].Serve_NRC[{structDIIndex}][{index}]      = {NRCCode};'''.format(Poss=Poss, structDIIndex=_, index=_NRC, NRCCode="0x{:X}".format(NRC))
        structCode = '''

  /********************2E结构体*****************/        
  Serve_Data[{Poss}].Serve                = 0x2E;
  Serve_Data[{Poss}].Serve_Fun_Count      = {count};'''.format(Poss=Poss, count=len(structDID)) + structCode

        self.UDS_Main_info += self.process_2E_DID(iniDID)
        return (structCode + "\n  ")

    def process_22_DID(self, Poss, RSP, NRC_list, NRC22, Addres, Session):
        """处理22_DID配置表"""
        sheetname = '22_DID'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        #           0       1       2           3               4            5                6          7       8     
        columns = ['DID号', 'DID描述', "字节数", '是否需安全验证', '是否测试', '数据未使用字节填充值', '解析方式', '响应内容', '是否可写']
        iniDID = ["DID_{}".format(buf) for buf in list(sheet[columns[0]])]
        structDID = []
        structCode = '''
   /********************22结构体*****************/
  Serve_Data[{Poss}].Serve                = 0x22;
  Serve_Data[{Poss}].Serve_Fun_Count      = {Serve_Fun_Count};                
  '''.format(Poss=Poss, Serve_Fun_Count=len(iniDID))
        ini_info = '\n##22读取DID配置\nDID_22_Traversal=[{}]{}\n'.format(len(iniDID), "{" + ",".join(iniDID) + "}")
        for _, row in sheet.iterrows():
            structDID.append(row[columns[0]])

            structCode += '''
            
  Serve_Data[{Poss}].Serve_Fun[{structDIIndex}]         = {Serve_Fun};
  Serve_Data[{Poss}].RSP[{structDIIndex}]               = {RSP};
  Serve_Data[{Poss}].Serve_Fun_Len[{structDIIndex}]     = 3;
  Serve_Data[{Poss}].Serve_Addres[{structDIIndex}]      = {Serve_Addres};
  Serve_Data[{Poss}].Serve_Session[{structDIIndex}]     = {Serve_Session};
  Serve_Data[{Poss}].Serve_NRC_Count[{structDIIndex}]   = {structDIDNRC_Count};
  Serve_Data[{Poss}].Security_Access[{structDIIndex}]   = {SSecurity_Access};
  Serve_Data[{Poss}].Serve_NRC22[{structDIIndex}]       = {Serve_NRC22};'''.format(Poss=Poss, RSP=str(int(RSP)), structDIIndex=_, Serve_Fun='0x' + row[columns[0]],
                                                                                     Serve_Addres=Addres, Serve_Session=Session,
                                                                                     structDIDNRC_Count=len(NRC_list), Serve_NRC22=int(NRC22) if pd.notna(NRC22) else 0,
                                                                                     SSecurity_Access=row[columns[3]] if pd.notna(row[columns[3]]) and row[columns[3]] != '/' else 0
                                                                                     )
            if isnotna(row[columns[4]]) == 1 or isnotna(row[columns[4]]) == '1':
                ini_info += "DID_{} = [{}],[{}],[0x{},0x{}]:[{}],[{}],[{}]\n".format(
                    row[columns[0]],
                    isnotna(row[columns[6]]),
                    row[columns[2]],
                    row[columns[0]][:2],
                    row[columns[0]][2:],
                    row[columns[7]] if pd.notna(row[columns[7]]) else '',
                    row[columns[8]] if pd.notna(row[columns[8]]) else '',
                    row[columns[5]] if pd.notna(row[columns[5]]) else '')

            if len(NRC_list) > 0:
                for _NRC, NRC in enumerate(NRC_list):
                    structCode += '''
  Serve_Data[{Poss}].Serve_NRC[{structDIIndex}][{index}]      = {NRCCode};'''.format(Poss=Poss, structDIIndex=_, index=_NRC, NRCCode="0x{:X}".format(NRC))

        self.UDS_Main_info += ini_info
        self.process_22_DIDs()
        return (structCode + "\n  ")

    def process_22_DIDs(self):
        """处理22_DIDs配置表"""
        sheetname = 'Read_DIDs'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        #           0       1       
        columns = ['DID号', 'DID描述']
        iniDID = ["0x{}".format(buf) for buf in list(sheet[columns[0]])]
        structDID = []
        ini_info = ''
        Flag_ = 0
        List_Plural_DID = []
        for _, row in sheet.iterrows():
            if pd.notna(row[columns[0]]):
                structDID.append(row[columns[0]])
                did = ','.join([f"[0x{element[:2]},0x{element[2:]}]" for element in str(row[columns[0]]).split(',')]) if pd.notna(row[columns[0]]) else ''
                Name = ''
                Name = 'Plural_DID_' + str(_)
                if ('不同' in row[columns[1]] and Flag_ < 3):
                    Flag_ += 1
                    ini_info += '''
#读取多个DID
DID_Read_Plural = {{{}}}\n'''.format(did)

                if ('相同' in row[columns[1]] and Flag_ < 3):
                    Flag_ += 1
                    ini_info += '''
#读取多个相同DID
DID_Read_Plural_Same = {{{}}}\n'''.format(did)

                if ('不支持' in row[columns[1]] and Flag_ < 3):
                    Flag_ += 1
                    ini_info += '''
#读取数据中含不支持DID
DID_Read_Plural_Some_NotSupport = {{{}}}\n'''.format(did)
                if (Flag_ > 3):
                    ini_info += '''
#其它:{}
{} = {{{}}}\n'''.format(str(row[columns[1]]), Name, did)
                    List_Plural_DID.append(Name)
                if (Flag_ == 3):
                    Flag_ += 1
        ini_info += '''
#其它:汇总测试
Other_Plural_DID = {}\n'''.format(str(List_Plural_DID).replace("'", ""))
        self.UDS_Main_info += ini_info

    def process_2E_DID(self, DIDlist):
        """处理2E_DID配置表"""
        sheetname = '2E_DID'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        List = [str(item) for item in sheet.columns[2:]]

        DIDlist1 = Counter(List)
        DIDlist2 = Counter(DIDlist)
        if DIDlist1 != DIDlist2:
            if DIDlist1 - DIDlist2:
                logger.error(f"<2E_DID>中配置的DID{list(DIDlist1 - DIDlist2)}在<2E_H>中没有配置")
                raise RuntimeError(f"<2E_DID>中配置的DID{list(DIDlist1 - DIDlist2)}在<2E_H>中没有配置")
            if DIDlist2 - DIDlist1:
                logger.error(f"<2E_H>中配置的DID{list(DIDlist2 - DIDlist1)}在<2E_DID>中没有配置")
                raise RuntimeError(f"<2E_H>中配置的DID{list(DIDlist2 - DIDlist1)}在<2E_DID>中没有配置")
        DIDtxt = "\n##2E写入DID配置\nDID_2E_Traversal=[{len}]{{{DID}}}\n".format(len=len(sheet.columns[2:]), DID=','.join(["DID2E_" + str('0000'[:4 - len(str(element))] + str(element)) for element in sheet.columns[2:]]))

        for DID in sheet.columns[2:]:
            if len(str(DID)) < 4:
                DIDstr = '0000'[:(4 - len(str(DID)))] + str(DID)
            else:
                DIDstr = DID
            DIDReadstr = ''
            DIDRead = str(sheet[DID][7]).replace("/", "nan").replace("0X", "").replace("0x", "").replace(",", "").replace("，", "")
            if (DIDRead != 'nan'):
                if len(str(DIDRead)) < 4:
                    DIDReadstr = '0000'[:(4 - len(str(DIDRead)))] + str(DIDRead)
                else:
                    DIDReadstr = DIDRead
                DIDReadstr = '0x' + DIDReadstr[:2] + ',' + '0x' + DIDReadstr[2:]

            DIDtxt += "DID2E_{DID}=[0x{DIDH},0x{DIDL}],([{dlc}],[{data}],[{result}]) ([{dlc1}],[{data1}],[{result1}]) [{padding}],[{redDID}]\n".format(DID=DIDstr, DIDH=DIDstr[:2], DIDL=DIDstr[2:],
                    dlc=sheet[DID][0], data=sheet[DID][1], result=sheet[DID][2], dlc1=sheet[DID][3], data1=sheet[DID][4], result1=sheet[DID][5], padding=sheet[DID][6], redDID=DIDReadstr)

        return (DIDtxt)

    def process_Serve(self):
        """处理服务配置表"""
        sheetname = '服务'
        if sheetname not in self.sheetnames:
            logger.error(f"缺少{sheetname}工作表")
            raise RuntimeError(f"缺少{sheetname}工作表")
        self.sheets[sheetname] = self._load_excel_sheets(sheetname)

        sheet = self.sheets[sheetname]
        Serve_count = 0
        Serve_dict = {}
        Serve_list = []
        #        0          1      2               3          4       5                 6                       7                   8                   9                   10              11          12              13                          14           15         16                      17
        columns = ["服务名称", "服务", "支持子功能列表", "子功能描述", "参数", "是否需要安全验证", "是否支持肯定响应抑制位", "默认模式\n物理寻址", "扩展模式\n物理寻址", "默认模式\n功能寻址", "扩展模式\n功能寻址", "NRC优先级", "NRC22的条件", "长安工厂模式NRC22的条件", "例程状态记录", "预期发送长度", "编程模式\n物理寻址", "编程模式\n功能寻址"]
        Sercount = 0
        Serve_Data_Count = 0
        Serve_31_Hex_Count = 0
        Ser = ''
        serbit = 0
        for index, ceil in enumerate(sheet[columns[1]]):
            if ceil == 'END':
                break
            if pd.notna(ceil):
                Serve_dict[ceil] = [0, 1]
                Serve_dict[ceil][0] = index
                Sercount = 1
                Ser = ceil
                serbit = index
                Serve_list.append(index)
            else:
                Serve_dict[Ser][1] += 1

        if '0x31' not in Serve_dict.keys():
            Serve_Data_Count = len(Serve_dict.keys())
        else:
            Serve_Data_Count = len(Serve_dict.keys()) - 1
        structCode = ''
        for _, row in sheet.iterrows():
            if pd.notna(row[columns[1]]) and row[columns[1]] in ["0x10", "0x11", "0x14", "0x19", "0x2E", '0x22', "0x28", "0x27", "0x28", "0x31", "0x34", "0x36", "0x37", "0x3E", "0x85"]:
                if _ != 0 and '0x31' not in row[columns[1]]:
                    Serve_count += 1
                Serve_ = row[columns[1]]
                Serve_Fun_num = Serve_dict[Serve_][1]
                if Serve_ not in ['0x31', '0x2E', '0x22']:
                    structCode += '''

  /********************{Serve}结构体*****************/        
  Serve_Data[{Poss}].Serve                = 0x{Serve};
  Serve_Data[{Poss}].Serve_Fun_Count      = {count};\n'''.format(Poss=Serve_count, Serve=Serve_[2:], count=Serve_Fun_num)

            Addres = 0
            Session = 0
            if (pd.notna(row[columns[7]]) and (row[columns[7]] == 1 or row[columns[7]] == '1')) or (pd.notna(row[columns[8]]) and (row[columns[8]] == 1 or row[columns[8]] == '1')) or (pd.notna(row[columns[16]]) and (row[columns[16]] == 1 or row[columns[16]] == '1')):
                Addres |= (1)
            if (pd.notna(row[columns[9]]) and (row[columns[9]] == 1 or row[columns[9]] == '1')) or (pd.notna(row[columns[10]]) and (row[columns[10]] == 1 or row[columns[10]] == '1')) or (pd.notna(row[columns[17]]) and (row[columns[17]] == 1 or row[columns[17]] == '1')):
                Addres |= (1 << 1)
            if (pd.notna(row[columns[8]]) and (row[columns[8]] == 1 or row[columns[8]] == '1')) or (pd.notna(row[columns[10]]) and (row[columns[10]] == 1 or row[columns[10]] == '1')):
                Session |= (1 << 2)
            if (pd.notna(row[columns[16]]) and (row[columns[16]] == 1 or row[columns[16]] == '1')) or (pd.notna(row[columns[17]]) and (row[columns[17]] == 1 or row[columns[17]] == '1')):
                Session |= (1 << 1)
            if (pd.notna(row[columns[9]]) and (row[columns[9]] == 1 or row[columns[9]] == '1')) or (pd.notna(row[columns[7]]) and (row[columns[7]] == 1 or row[columns[7]] == '1')):
                Session |= 1
            if Serve_ not in ['0x31', '0x2E', '0x22'] and Serve_dict[Serve_][0] <= _ < Serve_dict[Serve_][0] + Serve_dict[Serve_][1]:
                structCode += '''
                
  Serve_Data[{Poss}].Serve_Fun[{structDIIndex}]         = {Serve_Fun};            {commentate}
  Serve_Data[{Poss}].RSP[{structDIIndex}]               = {RSP};
  Serve_Data[{Poss}].Serve_Fun_Len[{structDIIndex}]     = {fun_len};
  Serve_Data[{Poss}].Serve_Addres[{structDIIndex}]      = {Serve_Addres};
  Serve_Data[{Poss}].Serve_Session[{structDIIndex}]     = {Serve_Session};
  Serve_Data[{Poss}].Serve_Para_Count[{structDIIndex}]  = {Serve_Para_Count};
  Serve_Data[{Poss}].Serve_NRC_Count[{structDIIndex}]   = {structDIDNRC_Count}; 
  Serve_Data[{Poss}].Security_Access[{structDIIndex}]   = {SSecurity_Access};
  Serve_Data[{Poss}].Serve_NRC22[{structDIIndex}]       = {Serve_NRC22};'''.format(commentate='//' + row[columns[3]] if pd.notna(row[columns[3]]) else '',
            Poss=Serve_count, structDIIndex=_ - Serve_dict[Serve_][0], RSP=str(row[columns[6]]).replace(".0", "") if pd.notna(row[columns[6]]) and row[columns[6]] != '/' else 0,
            Serve_Fun=('0x' + (row[columns[2]][2:] if '0x' in row[columns[2]] else row[columns[2]]) if pd.notna(row[columns[2]]) and row[columns[6]] != '/' else 0),
            Serve_Addres=Addres, Serve_Session=Session,
            structDIDNRC_Count=len(ast.literal_eval(row[columns[11]])) if pd.notna(row[columns[11]]) else 0,
            SSecurity_Access=str(int(row[columns[5]])) if pd.notna(row[columns[5]]) and row[columns[5]] != '/' else 0,
            Serve_Para_Count=len([ast.literal_eval(ii) for ii in str(row[columns[4]]).split('\n')]) if pd.notna(row[columns[4]]) and row[columns[4]] != '/' else 0,
            fun_len=isnotna(row[columns[15]]),
            Serve_NRC22=int(row[columns[12]]) if pd.notna(row[columns[12]]) and row[columns[12]] != '/' else 0
            )
                if pd.notna(row[columns[4]]) and row[columns[4]] != '/':
                    Serve_Para_list = [ast.literal_eval(ii) for ii in str(row[columns[4]]).split('\n')]
                    for _Para, Para in enumerate(Serve_Para_list):
                        code = '0x'
                        if isinstance(Para, int):
                            Para = [Para]
                        for data in Para:
                            code += '{:X}'.format(data)
                        structCode += '''
  Serve_Data[{Poss}].Serve_Para[{structDIIndex}][{index}]     = {ParaCode};
  Serve_Data[{Poss}].Serve_Para_Len[{structDIIndex}][{index}] = {Para_Len};'''.format(Poss=Serve_count, structDIIndex=_ - Serve_dict[Serve_][0], index=_Para, ParaCode=code, Para_Len=len(Para))
                if pd.notna(row[columns[11]]):
                    for _NRC, NRC in enumerate(ast.literal_eval(row[columns[11]])):
                        structCode += '''
  Serve_Data[{Poss}].Serve_NRC[{structDIIndex}][{index}]      = {NRCCode};'''.format(Poss=Serve_count, structDIIndex=_ - Serve_dict[Serve_][0], index=_NRC, NRCCode="0x{:X}".format(NRC))
            if Serve_ == '0x31':
                Var = self.process_31H()
                structCode += Var[0]
                self.struct.replace("_Serve_31_Hex_Count_", str(Var[1]))
            if Serve_ == '0x2E':
                structCode += self.process_2E_H(Serve_count, row[columns[12]], int(row[6]), Addres, Session)
            if Serve_ == '0x22':
                NRCList = []
                if pd.notna(row[columns[11]]):
                    NRCList = ast.literal_eval(row[columns[11]])
                structCode += self.process_22_DID(Serve_count, row[columns[6]], NRCList, row[columns[12]], Addres, Session)
        self.struct += '''
  Serve_Data_Count = {};
  Serve_31_Hex_Count = {};'''.format(Serve_Data_Count, str(Var[1]))
        self.struct += (structCode)

    def _isnotna(self, row):
        """判断值是否非 NaN"""
        return row if pd.notna(row) else 0

    def _returnStr(self, Strtxt):
        """将字符串中的特殊字符替换为下划线"""
        Strtxt = re.sub(r'[^a-zA-Z0-9\s]', '_', str(Strtxt))
        Strtxt = re.sub(' ', '_', str(Strtxt))
        return Strtxt
