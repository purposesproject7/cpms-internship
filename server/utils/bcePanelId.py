import pandas as pd
import re

# Function to clean and normalize faculty names for better matching
def normalize_name(name):
    if pd.isna(name):
        return ""
    name = str(name).strip()
    # Remove Dr., Prof., Ms., Mr., Mrs. prefixes
    name = re.sub(r'^(Dr\.|Prof\.|Ms\.|Mr\.|Mrs\.)\s*', '', name, flags=re.IGNORECASE)
    # Remove extra spaces
    name = ' '.join(name.split())
    return name.upper()

# Read both sheets from the Excel file
df_bce = pd.read_excel('D:\BTECH_CSEcore\Projects\pj2\FALL 25-26 INDUSTRIAL INTERNSHIP REVIEW- PANEL.xlsx', sheet_name='BCE')
df_faculty = pd.read_excel('D:\BTECH_CSEcore\Projects\pj2\FALL 25-26 INDUSTRIAL INTERNSHIP REVIEW- PANEL.xlsx', sheet_name='Faculty details')

# Create a dictionary of faculty names to employee IDs
faculty_dict = {}
for idx, row in df_faculty.iterrows():
    emp_id = str(row['Emp Id']).strip()
    faculty_name = row['Name of the Faculty']
    
    if pd.notna(faculty_name) and pd.notna(emp_id):
        # Normalize the name
        normalized_name = normalize_name(faculty_name)
        faculty_dict[normalized_name] = emp_id
        
        # Also store variations (with and without middle initials)
        parts = normalized_name.split()
        if len(parts) >= 2:
            simple_name = f"{parts[0]} {parts[-1]}"
            if simple_name not in faculty_dict:
                faculty_dict[simple_name] = emp_id

# Function to find employee ID for a panel member
def find_employee_id(panel_member_name):
    if pd.isna(panel_member_name) or panel_member_name == '':
        return ''
    
    normalized_panel = normalize_name(panel_member_name)
    
    # Direct match
    if normalized_panel in faculty_dict:
        return faculty_dict[normalized_panel]
    
    # Try matching with partial names
    for faculty_name, emp_id in faculty_dict.items():
        if normalized_panel in faculty_name or faculty_name in normalized_panel:
            return emp_id
    
    return ''

# Clean BCE data
df_bce_clean = df_bce[df_bce['Regno'].notna()].copy()
df_bce_clean = df_bce_clean[df_bce_clean['Name'].notna()]

# Create final output data
output_data = []

for idx, row in df_bce_clean.iterrows():
    student_name = row['Name']
    regno = row['Regno']
    panel_1 = row['Panel Member 1'] if pd.notna(row['Panel Member 1']) else ''
    panel_2 = row['Panel Member 2'] if pd.notna(row['Panel Member 2']) else ''
    
    # Get employee IDs
    emp_id_1 = find_employee_id(panel_1)
    emp_id_2 = find_employee_id(panel_2)
    
    output_data.append({
        'Student Name': student_name,
        'Registration Number': regno,
        'Panel Member 1': panel_1,
        'Panel Member 1 Employee ID': emp_id_1,
        'Panel Member 2': panel_2,
        'Panel Member 2 Employee ID': emp_id_2
    })

# Create DataFrame
df_output = pd.DataFrame(output_data)

# Save to Excel file
output_file = 'BCE_Students_Panel_Details.xlsx'
df_output.to_excel(output_file, index=False, sheet_name='Panel Details')

print(f"✓ Excel file '{output_file}' has been created successfully!")
print(f"✓ Total student records: {len(df_output)}")
print(f"\nColumns in output file:")
for col in df_output.columns:
    print(f"  - {col}")
