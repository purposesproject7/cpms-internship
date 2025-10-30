import pandas as pd

# Read the uploaded Excel file
df_input = pd.read_excel('D:\BTECH_CSEcore\Projects\pj2\Panel_Members_BAI.xlsx', sheet_name='Panel_Details')

# Clean the data - skip the header row and extract relevant columns
df_clean = df_input.iloc[1:].copy()
df_clean.columns = ['S.No.', 'Registration Number', 'Student Name', 'Panel']

# Remove rows where Registration Number is NaN or empty
df_clean = df_clean[df_clean['Registration Number'].notna()]
df_clean = df_clean[df_clean['Registration Number'] != '']

# Convert registration numbers to lowercase 'bai'
df_clean['Registration Number'] = df_clean['Registration Number'].astype(str)

# Create the final dataset with required columns
data_final = []

for index, row in df_clean.iterrows():
    reg_no = row['Registration Number']
    student_name = row['Student Name']
    email = f"{reg_no}@vitstudent.ac.in"
    
    data_final.append({
        'Project Name': student_name,
        'School': 'Scope',
        'Department': 'Internship',
        'Specialization': 'General',
        'Type': 'Software',
        'Guide Faculty Employee ID': 'FAC0010',
        'Student Name 1': student_name,
        'Reg No.': reg_no,
        'Email ID': email
    })

# Create DataFrame
df_final = pd.DataFrame(data_final)

# Save to Excel file
output_file = 'BAI_Students_Database22.xlsx'
df_final.to_excel(output_file, index=False, sheet_name='Students')

print(f"Excel file '{output_file}' created successfully with {len(df_final)} records!")
