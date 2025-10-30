import pandas as pd
import re

# Read both files
df_bds = pd.read_excel('D:\BTECH_CSEcore\Projects\pj2\FALL AY 25-26 BDS INDUSTRIAL INTERNSHIP PANEL MEMBERS.xlsx', sheet_name='BDS PANEL')
df_faculty = pd.read_excel('D:\BTECH_CSEcore\Projects\pj2\SCOPE FACULTY LIST-28.10.2025-Dr. M. Jayasudha.xlsx', sheet_name='Sheet1')

# Function to normalize faculty names for matching
def normalize_faculty_name(name):
    if pd.isna(name):
        return ""
    name = str(name).strip()
    # Remove Dr., Prof., Ms., Mr., Mrs. prefixes
    name = re.sub(r'^(Dr\.|Prof\.|Ms\.|Mr\.|Mrs\.)\s*', '', name, flags=re.IGNORECASE)
    # Remove extra spaces
    name = ' '.join(name.split())
    return name.upper()

# Create faculty dictionary: normalized name -> employee ID
faculty_dict = {}
for idx, row in df_faculty.iterrows():
    emp_id = str(row['Emp Id']).strip()
    faculty_name = row['Name of the Faculty']
    
    if pd.notna(faculty_name) and pd.notna(emp_id):
        # Normalize the name
        normalized_name = normalize_faculty_name(faculty_name)
        faculty_dict[normalized_name] = emp_id
        
        # Create variations with first and last name only
        parts = normalized_name.split()
        if len(parts) >= 2:
            simple_name = f"{parts[0]} {parts[-1]}"
            if simple_name not in faculty_dict:
                faculty_dict[simple_name] = emp_id

# Function to find employee ID for a panel member
def find_employee_id(panel_member_name):
    if pd.isna(panel_member_name) or panel_member_name == '':
        return 'emp'
    
    normalized_panel = normalize_faculty_name(panel_member_name)
    
    # Direct match
    if normalized_panel in faculty_dict:
        return faculty_dict[normalized_panel]
    
    # Try matching with partial names
    for faculty_name, emp_id in faculty_dict.items():
        if normalized_panel in faculty_name or faculty_name in normalized_panel:
            return emp_id
    
    return 'emp'

# Clean BDS data - remove duplicates
df_bds_clean = df_bds.drop_duplicates(subset=['Regno'], keep='first')

# Create output data
output_data = []

for idx, row in df_bds_clean.iterrows():
    student_name = row['Name']
    panel_1 = row['Panel Member 1'] if pd.notna(row['Panel Member 1']) else ''
    panel_2 = row['Panel Member 2'] if pd.notna(row['Panel Member 2']) else ''
    
    # Get employee IDs
    emp_id_1 = find_employee_id(panel_1)
    emp_id_2 = find_employee_id(panel_2)
    
    # Get shortened faculty names (remove prefixes)
    name_1 = normalize_faculty_name(panel_1) if panel_1 else ''
    name_2 = normalize_faculty_name(panel_2) if panel_2 else ''
    
    # Build panel string
    if name_1 and name_2:
        panel_string = f"{emp_id_1} {name_1} & {emp_id_2} {name_2}"
    elif name_1:
        panel_string = f"{emp_id_1} {name_1}"
    elif name_2:
        panel_string = f"{emp_id_2} {name_2}"
    else:
        panel_string = ""
    
    output_data.append({
        'Student Name': student_name,
        'Panel': panel_string
    })

# Create DataFrame
df_output = pd.DataFrame(output_data)

# Save to Excel
output_file = 'BDS_Students_Panel_With_EmployeeIDs.xlsx'
df_output.to_excel(output_file, index=False, sheet_name='Panel Details')

print(f"✓ Excel file '{output_file}' created successfully!")
print(f"✓ Total students: {len(df_output)}")
print(f"✓ Students with panels: {len(df_output[df_output['Panel'] != ''])}")
print(f"\nSample output (first 10 rows):")
print(df_output.head(10))
