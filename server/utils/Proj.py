import pandas as pd

INPUT_FILE = "Internship.xlsx"          # put the uploaded file in the same folder
OUTPUT_FILE = "Internship_Project_Panel_with_INTERNSHIP.xlsx"

# Column names in the uploaded file
PROJECT_COL = "Project Name"
PANEL_COL = "Panel"   # If your panel column is named differently, change this

def clean_text(s):
    if pd.isna(s):
        return ""
    # Normalize NBSP and extra spaces
    return str(s).replace("\u00A0", " ").strip()

def main():
    # Load
    df = pd.read_excel(INPUT_FILE)

    # Ensure required columns exist
    missing = [c for c in [PROJECT_COL, PANEL_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required column(s): {', '.join(missing)}")

    # Clean and transform Project Name, keep Panel
    out = pd.DataFrame({
        "Project Name": df[PROJECT_COL].apply(clean_text).astype(str) + " (INTERNSHIP)",
        "Panel": df[PANEL_COL].apply(clean_text)
    })

    # Optional: drop rows where Project Name was empty before appending
    out = out[out["Project Name"].str.strip() != " (INTERNSHIP)"].reset_index(drop=True)

    # Save
    out.to_excel(OUTPUT_FILE, index=False)
    print(f"✓ Created: {OUTPUT_FILE}")
    print(f"✓ Rows: {len(out)}")

if __name__ == "__main__":
    main()
