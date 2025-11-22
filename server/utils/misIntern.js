/**
 * Excel Transformation Script for Internship Projects
 * Reads input Excel and creates output Excel with specified columns
 * Uses ES6 import syntax
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_FILE = 'D:/BTECH_CSEcore/Projects/pj2/Panel_MIS_With Email (1).xlsx';
const OUTPUT_FILE = `Transformed_Internship_${new Date().toISOString().split('T')[0]}.xlsx`;

// Fixed values
const FIXED_GUIDE_EMPLOYEE_ID = 'FAC0010';
const FIXED_SCHOOL = 'SCOPE';
const FIXED_DEPARTMENT = 'M.Tech Integrated (MIS)';
const FIXED_SPECIALIZATION = 'general';
const FIXED_TYPE = 'Software';

function parsePanel(panelString) {
    if (!panelString || panelString.trim() === '') {
        return null;
    }
    
    // Extract faculty names and employee IDs from panel string
    // Example: "V. Muthumanikandan (51328) and Rajesh R(52879)"
    // Output: "51328 V. Muthumanikandan & 52879 Rajesh R"
    
    // Pattern to match: Name (empid)
    const regex = /([^()]+?)\s*\((\d+)\)/g;
    const matches = [...panelString.matchAll(regex)];
    
    if (matches.length === 0) {
        return null;
    }
    
    // Extract faculty name and employee ID pairs
    const facultyPairs = matches.map(match => {
        let facultyName = match[1].trim();
        
        // Remove "and" prefix/suffix from faculty name
        facultyName = facultyName.replace(/\s*\band\b\s*/gi, '').trim();
        
        const empId = match[2];
        return `${empId} ${facultyName}`;
    });
    
    // Join with " & " (without "and")
    return facultyPairs.join(' & ');
}

function transformExcel() {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('=== Excel Transformation Script ===');
        console.log('='.repeat(70));
        
        // Check if input file exists
        if (!fs.existsSync(INPUT_FILE)) {
            console.error(`\n❌ Error: Input file '${INPUT_FILE}' not found!`);
            console.error('Please make sure the file exists at the specified path.');
            process.exit(1);
        }
        
        console.log(`\n📂 Reading input file: ${INPUT_FILE}`);
        
        // Read the Excel file
        const workbook = XLSX.readFile(INPUT_FILE);
        const sheetName = workbook.SheetNames[0]; // Get first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`✅ Successfully read ${jsonData.length} rows from sheet: ${sheetName}`);
        
        // Transform the data
        console.log('\n🔄 Transforming data...');
        
        let lastPanel = null; // To store and repeat the last valid panel
        
        const transformedData = jsonData.map((row, index) => {
            // Get panel value
            let panelValue = parsePanel(row['Panel']);
            
            // If current row has no panel, use the last valid panel
            if (!panelValue && lastPanel) {
                panelValue = lastPanel;
            } else if (panelValue) {
                lastPanel = panelValue; // Update last valid panel
            }
            
            return {
                'Project Name': `${row['REGISTER NUMBER']} (INTERNSHIP)`,
                'Guide Faculty Employee ID': FIXED_GUIDE_EMPLOYEE_ID,
                'School': FIXED_SCHOOL,
                'Department': FIXED_DEPARTMENT,
                'Specialization': FIXED_SPECIALIZATION,
                'Type': FIXED_TYPE,
                'Student Name 1': row['STUDENT NAME'] || '',
                'Student RegNo 1': row['REGISTER NUMBER'] || '',
                'Student Email 1': row['Email ID'] || '',
                'Student Name 2': '',
                'Student RegNo 2': '',
                'Student Email 2': '',
                'Student Name 3': '',
                'Student RegNo 3': '',
                'Student Email 3': '',
                'Panel': panelValue || ''
            };
        });
        
        console.log(`✅ Transformed ${transformedData.length} rows`);
        
        // Create new workbook
        console.log('\n📝 Creating output Excel file...');
        const newWorkbook = XLSX.utils.book_new();
        const newWorksheet = XLSX.utils.json_to_sheet(transformedData);
        
        // Auto-size columns
        const colWidths = [
            { wch: 30 }, // Project Name
            { wch: 25 }, // Guide Faculty Employee ID
            { wch: 15 }, // School
            { wch: 30 }, // Department
            { wch: 15 }, // Specialization
            { wch: 15 }, // Type
            { wch: 30 }, // Student Name 1
            { wch: 20 }, // Student RegNo 1
            { wch: 40 }, // Student Email 1
            { wch: 30 }, // Student Name 2
            { wch: 20 }, // Student RegNo 2
            { wch: 40 }, // Student Email 2
            { wch: 30 }, // Student Name 3
            { wch: 20 }, // Student RegNo 3
            { wch: 40 }, // Student Email 3
            { wch: 60 }  // Panel (made wider for faculty info)
        ];
        newWorksheet['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Internship_Projects');
        
        // Write to file
        XLSX.writeFile(newWorkbook, OUTPUT_FILE);
        
        console.log(`✅ Output file created: ${OUTPUT_FILE}`);
        
        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('=== TRANSFORMATION SUMMARY ===');
        console.log('='.repeat(70));
        console.log(`Input File: ${INPUT_FILE}`);
        console.log(`Output File: ${OUTPUT_FILE}`);
        console.log(`Total Records: ${transformedData.length}`);
        console.log(`Records with Panel: ${transformedData.filter(r => r.Panel).length}`);
        console.log(`Records without Panel: ${transformedData.filter(r => !r.Panel).length}`);
        console.log('\n✅ Transformation complete!\n');
        
        // Display first 5 rows as sample
        console.log('=== SAMPLE OUTPUT (First 5 rows) ===');
        console.log('='.repeat(70));
        transformedData.slice(0, 5).forEach((row, i) => {
            console.log(`\nRow ${i + 1}:`);
            console.log(`  Project Name: ${row['Project Name']}`);
            console.log(`  Student Name: ${row['Student Name 1']}`);
            console.log(`  Student RegNo: ${row['Student RegNo 1']}`);
            console.log(`  Student Email: ${row['Student Email 1']}`);
            console.log(`  Panel: ${row['Panel']}`);
        });
        console.log('\n' + '='.repeat(70));
        
    } catch (error) {
        console.error('\n💥 Error during transformation:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the transformation
transformExcel();

export { transformExcel };
