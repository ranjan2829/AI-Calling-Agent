import json
import re
import os
import glob
import csv
from datetime import datetime
def load_job_description():
    try:
        jd_file_path = "current_jd.json"     
        if os.path.exists(jd_file_path):
            with open(jd_file_path, 'r') as f:
                jd_data = json.load(f)
            return jd_data
        else:
            return {"error": "current_jd.json file not found"}        
    except Exception as e:
        return {"error": f"Failed to load JD: {str(e)}"}
def extract_candidate_info_from_csv(call_sid):
    try:
        csv_mapping_file = "bulk_call_mapping.json"
        if os.path.exists(csv_mapping_file):
            with open(csv_mapping_file, 'r') as f:
                mapping = json.load(f)
                if call_sid in mapping:
                    return mapping[call_sid]
        csv_files = glob.glob("*.csv")
        for csv_file in csv_files:
            try:
                with open(csv_file, 'r') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if 'phone' in row and 'call_sid' in row:
                            if row.get('call_sid') == call_sid:
                                return {'name': row.get('name', ''), 'phone': row.get('phone', ''), 'email': row.get('email', ''), 'source': 'csv_bulk_call'}
            except:
                continue
        return None
    except Exception as e:
        return None
def extract_candidate_name(responses, call_sid=None):
    if call_sid:
        csv_info = extract_candidate_info_from_csv(call_sid)
        if csv_info and csv_info.get('name'):
            name = csv_info['name'].strip()
            if name:
                clean_name = re.sub(r'[^\w\s]', '', name).strip()
                return "_".join(clean_name.split()[:2])
    if not responses:
        return f"Unknown_{call_sid[:8]}" if call_sid else "Unknown"
    first_answer = responses[0].get('answer', '').strip()
    if not first_answer or first_answer.lower() in ['', 'uh', 'um', 'well']:
        return f"Unknown_{call_sid[:8]}" if call_sid else "Unknown"
    words = first_answer.split()
    name_words = []
    for word in words[:3]:
        clean_word = re.sub(r'[^\w]', '', word).strip()
        if clean_word and len(clean_word) > 1 and clean_word.lower() not in ['uh', 'um', 'well', 'yeah', 'yes', 'no', 'hi', 'hello']:
            name_words.append(clean_word.title())
    if name_words:
        return "_".join(name_words)
    else:
        return f"Candidate_{call_sid[:8]}" if call_sid else "Unknown"
def get_candidate_metadata(call_sid):
    metadata = {'source': 'voice_call', 'phone': None, 'email': None, 'csv_data': None}
    csv_info = extract_candidate_info_from_csv(call_sid)
    if csv_info:
        metadata.update(csv_info)
    return metadata
def save_unique_match_report(report, call_sid, candidate_name):
    try:
        os.makedirs("interviews", exist_ok=True)
        safe_name = re.sub(r'[^\w\-_]', '_', candidate_name)
        safe_name = safe_name[:30]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"interviews/{safe_name}_{call_sid[:12]}_{timestamp}_JD_ANALYSIS.json"
        existing_pattern = f"interviews/*{call_sid[:12]}*JD_ANALYSIS.json"
        existing_files = glob.glob(existing_pattern)
        for old_file in existing_files:
            if old_file != filename:
                try:
                    os.remove(old_file)
                except:
                    pass
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        return filename
    except Exception as e:
        return None

def create_bulk_call_summary():
    try:
        pattern = "interviews/*_JD_ANALYSIS.json"
        analysis_files = glob.glob(pattern)
        if not analysis_files:
            return {"error": "No analysis files found"}
        bulk_summary = {"total_candidates": len(analysis_files), "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "candidates": [], "statistics": {"excellent_match": 0, "strong_match": 0, "good_match": 0, "moderate_match": 0, "low_match": 0}}
        for file_path in analysis_files:
            try:
                with open(file_path, 'r') as f:
                    analysis = json.load(f)
                candidate_summary = {"name": analysis.get("candidate_name", "Unknown"), "call_id": analysis.get("call_id", ""), "overall_score": analysis.get("candidate_analysis", {}).get("overall_score", 0), "recommendation": analysis.get("candidate_analysis", {}).get("recommendation", ""), "matched_skills": analysis.get("candidate_analysis", {}).get("matched_skills", []), "analysis_file": file_path}
                bulk_summary["candidates"].append(candidate_summary)
                recommendation = candidate_summary["recommendation"]
                if "EXCELLENT" in recommendation:
                    bulk_summary["statistics"]["excellent_match"] += 1
                elif "STRONG" in recommendation:
                    bulk_summary["statistics"]["strong_match"] += 1
                elif "GOOD" in recommendation:
                    bulk_summary["statistics"]["good_match"] += 1
                elif "MODERATE" in recommendation:
                    bulk_summary["statistics"]["moderate_match"] += 1
                else:
                    bulk_summary["statistics"]["low_match"] += 1
            except Exception as e:
                continue
        bulk_summary["candidates"].sort(key=lambda x: x["overall_score"], reverse=True)
        summary_filename = f"interviews/BULK_SUMMARY_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(summary_filename, 'w') as f:
            json.dump(bulk_summary, f, indent=2)
        return bulk_summary
    except Exception as e:
        return {"error": str(e)}
def analyze_candidate_responses(responses, call_id="unknown"):
    jd_data = load_job_description()
    if "error" in jd_data:
        return {"error": jd_data["error"]} 
    jd_required_skills = jd_data.get("required_skills", [])
    jd_experience = jd_data.get("experience_required", "0")   
    candidate_metadata = get_candidate_metadata(call_id)
    interview_phone = get_phone_from_interview_data(call_id)
    if interview_phone:
        candidate_metadata["phone"] = interview_phone
    full_transcript = " ".join([response.get('answer', '') for response in responses])
    matched_skills, skill_mentions = extract_skills_mentioned_by_candidate(full_transcript, jd_required_skills)
    experience_data = extract_experience_level(full_transcript)
    scores = calculate_match_score(matched_skills, len(jd_required_skills), experience_data, jd_experience)
    overall_score = scores["overall_score"]
    if overall_score >= 80:
        recommendation = "EXCELLENT MATCH"
        priority = 5
    elif overall_score >= 65:
        recommendation = "STRONG MATCH"
        priority = 4
    elif overall_score >= 50:
        recommendation = "GOOD MATCH"
        priority = 3
    elif overall_score >= 35:
        recommendation = "MODERATE MATCH"
        priority = 2
    else:
        recommendation = "LOW MATCH"
        priority = 1
    missing_skills = [skill for skill in jd_required_skills if skill not in matched_skills]
    return {
        "job_title": jd_data.get("title", ""),
        "company": jd_data.get("company", ""),
        "jd_required_skills": jd_required_skills,
        "experience_required": jd_experience,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "skills_match_percentage": scores["skills_match_percent"],
        "experience_match_percentage": scores["experience_match_percent"],
        "overall_score": overall_score,
        "comprehensive_score": overall_score,  
        "priority_score": priority,
        "recommendation": recommendation,
        "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "skill_mentions": skill_mentions,
        "experience_data": experience_data,
        "candidate_metadata": candidate_metadata,
        "found_skills": matched_skills,
        "skills_found_count": len(matched_skills),
        "total_required_skills": len(jd_required_skills),
        "phone_number": candidate_metadata.get("phone", "unknown")  # Include phone number
    }

def get_phone_from_interview_data(call_sid):
    try:
        session_file = f"interviews/session_{call_sid}.json"
        if os.path.exists(session_file):
            with open(session_file, 'r') as f:
                session_data = json.load(f)
                return session_data.get("phone_number")
        pattern = f"interviews/{call_sid}_COMPLETED_*.json"
        files = glob.glob(pattern)
        if files:
            with open(files[0], 'r') as f:
                interview_data = json.load(f)
                return interview_data.get("phone_number")
        mapping_file = "call_phone_mapping.json"
        if os.path.exists(mapping_file):
            with open(mapping_file, 'r') as f:
                mappings = json.load(f)
                if call_sid in mappings:
                    return mappings[call_sid].get("phone_number")
        return None
    except Exception as e:
        print(f"Error getting phone from interview data: {e}")
        return None
def extract_skills_mentioned_by_candidate(text, jd_skills):
    text_lower = text.lower()
    mentioned_skills = []
    skill_mentions = {}
    for jd_skill in jd_skills:
        skill_lower = jd_skill.lower()
        patterns = [
            r'\b' + re.escape(skill_lower) + r'\b', 
            r'\b' + re.escape(skill_lower.replace('.', '')) + r'\b', 
            r'\b' + re.escape(skill_lower.replace(' ', '')) + r'\b', 
            r'\b' + re.escape(skill_lower.replace('+', r'\+')) + r'\b'
        ]
        total_matches = 0
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            total_matches += len(matches)
        if total_matches > 0:
            mentioned_skills.append(jd_skill)
            skill_mentions[jd_skill] = total_matches
    return mentioned_skills, skill_mentions

def extract_experience_level(text):
    text_lower = text.lower()
    year_patterns = [r'(\d+)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)', r'(\d+)\+?\s*(?:years?|yrs?)', r'over\s*(\d+)\s*(?:years?|yrs?)', r'(\d+)\s*to\s*(\d+)\s*(?:years?|yrs?)']
    years_mentioned = []
    for pattern in year_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            if isinstance(match, tuple):
                years_mentioned.extend(match)
            else:
                years_mentioned.append(match)
    return {"years_mentioned": years_mentioned, "experience_score": len(years_mentioned) * 2}
def calculate_match_score(matched_skills, total_required_skills, experience_data, jd_experience_required):
    skills_match_percent = (len(matched_skills) / max(total_required_skills, 1)) * 100
    experience_match = 50
    if experience_data["years_mentioned"]:
        try:
            candidate_max_years = max([int(year) for year in experience_data["years_mentioned"] if year.isdigit()])
            required_years = int(jd_experience_required.split('-')[0]) if '-' in str(jd_experience_required) else int(jd_experience_required or 0)
            if candidate_max_years >= required_years:
                experience_match = 100
            else:
                experience_match = (candidate_max_years / max(required_years, 1)) * 100
        except:
            experience_match = 50
    overall_score = (skills_match_percent * 0.8) + (experience_match * 0.2)
    return {"skills_match_percent": round(skills_match_percent, 1), "experience_match_percent": round(experience_match, 1), "overall_score": round(overall_score, 1)}
def analyze_all_completed_interviews():
    try:
        pattern = "interviews/*_COMPLETED_*.json"
        interview_files = glob.glob(pattern)
        if not interview_files:
            return {"error": "No completed interviews found"}
        results = []
        for interview_file in interview_files:
            interview_data = load_interview_data(interview_file)
            if not interview_data:
                continue
            call_sid = interview_data.get("interview_id", "unknown")
            responses = interview_data.get("responses", [])
            if not responses:
                continue
            existing_pattern = f"interviews/*{call_sid[:12]}*JD_ANALYSIS.json"
            existing_files = glob.glob(existing_pattern)
            if existing_files:
                try:
                    with open(existing_files[0], 'r') as f:
                        existing_report = json.load(f)
                        results.append(existing_report)
                except:
                    pass
                continue
            candidate_name = extract_candidate_name(responses, call_sid)
            analysis = analyze_candidate_responses(responses, call_sid)
            if "error" in analysis:
                continue
            report = {"call_id": call_sid, "candidate_name": candidate_name, "candidate_analysis": analysis, "interview_summary": {"questions_answered": len(responses), "total_questions": interview_data.get("total_questions", 5), "completion_rate": f"{len(responses)}/{interview_data.get('total_questions', 5)}"}, "analysis_created": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            save_unique_match_report(report, call_sid, candidate_name)
            results.append(report)
        if len(results) > 1:
            bulk_summary = create_bulk_call_summary()
        return {"success": True, "analyzed": len(results), "results": results}
    except Exception as e:
        return {"error": str(e)}
def load_interview_data(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except:
        return None
def get_latest_interview_file():
    try:
        pattern = "interviews/*_COMPLETED_*.json"
        files = glob.glob(pattern)
        if not files:
            return None
        return max(files, key=os.path.getmtime)
    except:
        return None
def generate_match_report_from_file(file_path=None):
    if not file_path:
        file_path = get_latest_interview_file()
        if not file_path:
            return {"error": "No interview files found"}
    interview_data = load_interview_data(file_path)
    if not interview_data:
        return {"error": "Could not load interview data"}
    call_sid = interview_data.get("interview_id", "unknown")
    responses = interview_data.get("responses", [])
    if not responses:
        return {"error": "No responses found"}
    existing_pattern = f"interviews/*{call_sid[:12]}*JD_ANALYSIS.json"
    existing_files = glob.glob(existing_pattern)
    if existing_files:
        try:
            with open(existing_files[0], 'r') as f:
                return json.load(f)
        except:
            pass
    candidate_name = extract_candidate_name(responses, call_sid)
    analysis = analyze_candidate_responses(responses, call_sid)
    if "error" in analysis:
        return analysis
    report = {"call_id": call_sid, "candidate_name": candidate_name, "candidate_analysis": analysis, "interview_summary": {"questions_answered": len(responses), "total_questions": interview_data.get("total_questions", 5), "completion_rate": f"{len(responses)}/{interview_data.get('total_questions', 5)}"}, "analysis_created": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    save_unique_match_report(report, call_sid, candidate_name)
    return report
def run_jd_analysis():
    result = analyze_all_completed_interviews()
    if "error" not in result:
        if result['results']:
            return result['results'][-1]
    return {"error": result.get("error", "Analysis failed")}
if __name__ == "__main__":
    result = run_jd_analysis()
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print("Analysis completed successfully!")