import pandas as pd

# List of all projects
projects = [
    "Text Steganography system",
    "Offensive language detection with knowledge distillation",
    "The Impact of Parenting on Adult Behavior",
    "AI-Powered Student Performance Analyzer (Tentative)",
    "Medical Image Analysis using AI and ML",
    "Automated Food Safety And Quality Assessment System",
    "Fake news Detection",
    "Asymmetric Key Cryptography for Confidential and Authentic Forensic Data Transfer",
    "automated negotiation and lowballing bot / price-haggling bot for online marketplace",
    "Human Recognition System",
    "Semantic Search Engine for Academic Papers",
    "Smart Tourist Safety Monitoring & Incident Response System",
    "Tentative Project",
    "Secure cloud based academic search engine",
    "Healthy harvest using Deep Learning Models",
    "Reliable-based multi-objective optimization algorithm for VM placement using intelligent PCA in a cloud environment",
    "Digital twin framework for Higher Education curriculum design",
    "Digital Twin–Enabled Framework for Forecasting and Mitigating Fraud",
    "Reinforcement Learning Game AI",
    "An AI System for Post-Disaster Intelligence and Resource Allocation",
    "Data analyst (customer segmentation and sales prediction for retail business)",
    "Object Detection and Tracking using Computer Vision",
    "Al-Powered Speech Emotion Recognition for Remote Mental Health Monitoring",
    "Image processing using deep learning",
    "Mindful Momentum: An AI-Powered System for Correlating Physical Activity and Subjective Mental Well-being",
    "Image Processing using Deep Learning",
    "Multimodal Deep Learning for Early Sepsis Prediction",
    "Virtual Herbal Garden: An Immersive D Platform for Exploring Medicinal Plants",
    "MediGraph: AI-Powered Mapping of Drug–Target Landscapes",
    "DemandSense: AI-Driven Forecasting with Social Insights",
    "Fault Detecting System Using AI and IoT",
    "Anomaly Detection in Network Traffic: A Multi-Dataset Approach using ML, DL, and Hybrid Models",
    "AI/ML applications in finance sector.",
    "Survival Analysis of Cancer Paitent",
    "Intelligent Transcript Processing Engine: Use NLP (Natural Language Processing) techniques to analyze video transcripts from YouTube's auto-generated",
    "impact of quantum entanglement in distributed computing",
    "A Comprehensive Study of Artificial Intelligence Techniques in Image Processing",
    "Smart Healthcare Assistant Using LLMs",
    "Explainable AI and Blockchain for Intrusion Detection System",
    "Project Work",
    "Trust Decay in the Digital Public Sphere: Measuring How Deepfakes Reshape Public Perception of Truth.",
    "Disease Prediction Using Ml",
    "Research on Cryptocurrency",
    "healthcare prediction",
    "Automated Disaster Impact Assessment using Deep Learning",
    "Scheduling in FiveG private network",
    "Smart Multi-Disease Prediction & Recommendation System using ML",
    "AI-Enabled Non-Invasive Diagnosis of NAFLD: A Multimodal Approach.",
    "LLM chat tree format integration",
    "AI Powered Phishing Detector",
    "Enhancement of Low-Light Images",
    "Intelligent ICU Bed Management System Using Data Science and Large Language Models",
    "Image Classification",
    "Impact of Exercise Therapy on Musculoskeletal Disorders Using Motion Tracking Techniques",
    "Autonomous Robot Navigation Using Reinforcement Learning",
    "A Secure and Auditable Digital Locker for Time Bound Information Sharing",
    "Cloud based Devsecops threat intelligence system",
    "Augmenting the classification results of Unsupervised Learning Techniques",
    "Street Smart: A Hyperlocal Delivery and Local Store Connect Platform",
    "SMARTHIRE",
    "Machine learning and deep learning based classification system",
    "A Deep Learning Enhanced Oversampling Framework for Imbalanced Image Datasets",
    "Intelligent Cloud Storage with AI based optimization",
    "Smart price and review aggregator",
    "BlockCert+: A Blockchain and IPFS-Based Decentralized Framework for Secure and Scalable Academic Certificate Verification.",
    "AI-Powered Framework for Habit Management, Mood Prediction, and Financial Goal Tracking",
    "lmage based breed recognition for cattle and buffaloes of India",
    "Customer data platform",
    "HealthIQ: Intelligent Diagnostic Assistant",
    "Multi organ segmentation-Medical image using deep learning",
    "CYBER INCIDENTS DATABASE",
    "A Predictive model for Enhancing Women Safety Using community-Driven Data",
    "SUSTAINABLE WASTE MANAGEMENT",
    "Smart Waste Management",
    "Blockchain-Based Agri-Product Traceability and Authentication System",
    "Secure Medical Image Encryption",
    "AI FORENSIC APPLICATION",
    "INTRUSION DETECTION SYSTEM (IDC)"
]

# List of student registration numbers (lowercase mca)
reg_numbers = [
    "25mca1001", "25mca1002", "25mca1003", "25mca1004", "25mca1005",
    "25mca1006", "25mca1007", "25mca1008", "25mca1009", "25mca1011",
    "25mca1012", "25mca1014", "25mca1015", "25mca1016", "25mca1017",
    "25mca1018", "25mca1019", "25mca1020", "25mca1021", "25mca1022",
    "25mca1023", "25mca1024", "25mca1025", "25mca1026", "25mca1027",
    "25mca1028", "25mca1029", "25mca1030", "25mca1031", "25mca1032",
    "25mca1033", "25mca1034", "25mca1035", "25mca1036", "25mca1037",
    "25mca1038", "25mca1039", "25mca1040", "25mca1041", "25mca1042",
    "25mca1043", "25mca1044", "25mca1046", "25mca1047", "25mca1048",
    "25mca1049", "25mca1050", "25mca1051", "25mca1053", "25mca1054",
    "25mca1056", "25mca1057", "25mca1058", "25mca1059", "25mca1061",
    "25mca1062", "25mca1063", "25mca1064", "25mca1065", "25mca1066",
    "25mca1068", "25mca1069", "25mca1070", "25mca1071", "25mca1072",
    "25mca1073", "25mca1074", "25mca1075", "25mca1076", "25mca1077",
    "25mca1078", "25mca1079", "25mca1080", "25mca1081", "25mca1082",
    "25mca1083", "25mca1084", "25mca1085"
]

# Function to determine specialization based on project keywords
def get_specialization(project_name):
    project_lower = project_name.lower()
    
    if any(keyword in project_lower for keyword in ['cryptography', 'security', 'intrusion', 'phishing', 'encryption', 'forensic', 'cyber']):
        return 'Cyber Security'
    elif any(keyword in project_lower for keyword in ['blockchain', 'cryptocurrency', 'blockcert']):
        return 'Blockchain'
    elif any(keyword in project_lower for keyword in ['iot', 'robot', 'hardware']):
        return 'IoT'
    elif any(keyword in project_lower for keyword in ['cloud', 'vm placement', 'devsecops']):
        return 'Cloud Computing'
    elif any(keyword in project_lower for keyword in ['data analyst', 'customer segmentation', 'sales prediction', 'data platform', 'forecasting', 'prediction', 'survival analysis']):
        return 'Data Science'
    elif any(keyword in project_lower for keyword in ['ai', 'ml', 'deep learning', 'machine learning', 'neural', 'image processing', 'computer vision', 'nlp', 'llm', 'detection', 'recognition', 'classification', 'segmentation', 'reinforcement learning']):
        return 'AI/ML'
    elif any(keyword in project_lower for keyword in ['platform', 'marketplace', 'search engine', 'bot']):
        return 'Web Development'
    else:
        return 'General'

# Function to determine project type
def get_type(project_name):
    project_lower = project_name.lower()
    if any(keyword in project_lower for keyword in ['iot', 'robot', 'autonomous', 'hardware']):
        return 'Hardware'
    else:
        return 'Software'

# Create the complete dataset
data = []

for i, project in enumerate(projects):
    specialization = get_specialization(project)
    project_type = get_type(project)
    email = f"{reg_numbers[i]}@vitstudent.ac.in"
    
    data.append({
        'Project Name': project,
        'School': 'Scope',
        'Department': 'MCA 1st Year',
        'Specialization': specialization,
        'Type': project_type,
        'Email ID': email
    })

# Create DataFrame
df = pd.DataFrame(data)

# Save to Excel file
output_file = 'MCA_Projects_Database.xlsx'
df.to_excel(output_file, index=False, sheet_name='Projects')

print(f"Excel file '{output_file}' has been created successfully!")
print(f"Total projects: {len(df)}")
