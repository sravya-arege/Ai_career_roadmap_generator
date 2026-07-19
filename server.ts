/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header per guidelines
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Using dry-run mode for AI tasks.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiEnabled: !!process.env.GEMINI_API_KEY
  });
});

// 2. Career Assessment Module
app.post('/api/assess', async (req, res) => {
  const { codingInterest, logicalThinking, dataAnalysisInterest, designInterest, communicationSkills, targetRole, skills } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    // Return high quality mock data in case API key is missing
    return res.json({
      personalityAnalysis: "You exhibit a balanced technical mind with strong analytical capabilities. You lean towards creating structured solutions and manifest deep visual and user experience appreciation.",
      recommendedRoles: [
        { role: targetRole || "Full Stack Developer", score: 92, reason: "Excellent alignment with your coding interests and current technical skills." },
        { role: "Software Engineer", score: 85, reason: "Strong logical thinking foundations and algorithmic core interest." },
        { role: "AI Engineer", score: 78, reason: "Driven by analytical curiosity and scalable server architecture concepts." }
      ]
    });
  }

  try {
    const prompt = `Perform a career personality and suitability analysis for a student with the following profile:
    - Coding Interest: ${codingInterest}/5
    - Logical thinking score: ${logicalThinking}/5
    - Data Analysis score: ${dataAnalysisInterest}/5
    - Design/Front-end interest score: ${designInterest}/5
    - Communication Skills score: ${communicationSkills}/5
    - Identified target role: ${targetRole || "Software Engineer"}
    - Extant skills: ${skills ? skills.join(', ') : 'None listed yet'}

    Provide a highly actionable assessment in JSON. Use this structure:
    {
      "personalityAnalysis": "string detailed report",
      "recommendedRoles": [
        {"role": "string", "score": numberPercent, "reason": "string reason of alignment"}
      ]
    }`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personalityAnalysis: { type: Type.STRING, description: "Detailed career suitability critique" },
            recommendedRoles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  reason: { type: Type.STRING }
                },
                required: ["role", "score", "reason"]
              }
            }
          },
          required: ["personalityAnalysis", "recommendedRoles"]
        }
      }
    });

    const parsed = JSON.parse(apiResponse.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini assessment error:", error);
    res.status(500).json({ error: "Failed to perform career assessment using AI.", details: error.message });
  }
});

// 3. AI Roadmap Generator
app.post('/api/roadmap', async (req, res) => {
  const { profile, assessmentResults } = req.body;
  const ai = getGeminiClient();

  const targetRole = profile?.targetRole || "Software Engineer";
  const userSkills = profile?.skills ? profile.skills.join(', ') : "None specified";

  if (!ai) {
    // High premium mockup roadmap
    return res.json({
      targetRole,
      threeMonth: {
        skills: ["Advanced Algorithms", "Responsive Database Schema Design", "REST API Development"],
        resources: ["LeetCode Easy/Medium problems", "Spring Academy or React Docs", "System Design Primer"],
        projects: ["Interactive Personal Workspace Portal"]
      },
      sixMonth: {
        skills: ["Cloud Architecture Basics (AWS/GCP)", "Docker containerization", "Unit Testing / Mockito / Jest"],
        resources: ["AWS Training Portal", "Docker Deep Dive courses", "Clean Code book by Robert Martin"],
        projects: ["Containerized Fullstack E-Commerce micro-service backend"]
      },
      twelveMonth: {
        skills: ["System Design & High Availability", "CI/CD Orchestration", "Caching Layers (Redis/Memcached)"],
        resources: ["Designing Data-Intensive Applications", "GitHub Actions workflows manual"],
        projects: ["Real-time Collaborative whiteboard canvas system with Auth"]
      },
      twentyFourMonth: {
        skills: ["Microservices Architecture", "OAuth 2.0 Identity Management", "Relational Tuning"],
        resources: ["Spring Cloud Tutorials", "High-Performance Java Persistence"],
        projects: ["Production-ready Career Roadmap enterprise planner"]
      },
      dailyTasks: [
        "Solve 2 DSA problems in current category",
        "Read 1 tech article or documentation chapter",
        "Commit at least 15 lines of quality code to your roadmap project"
      ],
      weeklyTasks: [
        "Complete 1 major learning milestone or module",
        "Conduct a simulated peer-review on your written code",
        "Write a summary post on LinkedIn outlining this week's technical takeaways"
      ],
      monthlyMilestones: [
        "Deliver a functional, standalone feature package on GitHub",
        "Conduct a 30-minute test interview with the Placement Tutors",
        "Revise resume profile keywords based on current monthly progress metrics"
      ]
    });
  }

  try {
    const prompt = `You are a high-level Placement Mentor and Career Guide. Generate a complete structural roadmap for a student aiming for the role of "${targetRole}".
    Current skills of the student: "${userSkills}".
    CGPA: ${profile?.cgpa || "N/A"}. Branch: ${profile?.branch || "N/A"}.

    Generate a detailed response in JSON with these exact properties:
    - targetRole: String
    - threeMonth: { skills: Array, resources: Array, projects: Array }
    - sixMonth: { skills: Array, resources: Array, projects: Array }
    - twelveMonth: { skills: Array, resources: Array, projects: Array }
    - twentyFourMonth: { skills: Array, resources: Array, projects: Array }
    - dailyTasks: Array of 3 daily tasks to build discipline
    - weeklyTasks: Array of 3 weekly tasks
    - monthlyMilestones: Array of 3 key monthly checkmarks

    Be highly specific and rigorous with technical recommendations!`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetRole: { type: Type.STRING },
            threeMonth: {
              type: Type.OBJECT,
              properties: {
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["skills", "resources", "projects"]
            },
            sixMonth: {
              type: Type.OBJECT,
              properties: {
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["skills", "resources", "projects"]
            },
            twelveMonth: {
              type: Type.OBJECT,
              properties: {
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["skills", "resources", "projects"]
            },
            twentyFourMonth: {
              type: Type.OBJECT,
              properties: {
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["skills", "resources", "projects"]
            },
            dailyTasks: { type: Type.ARRAY, items: { type: Type.STRING } },
            weeklyTasks: { type: Type.ARRAY, items: { type: Type.STRING } },
            monthlyMilestones: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["targetRole", "threeMonth", "sixMonth", "twelveMonth", "twentyFourMonth", "dailyTasks", "weeklyTasks", "monthlyMilestones"]
        }
      }
    });

    const roadmapData = JSON.parse(apiResponse.text || '{}');
    res.json(roadmapData);
  } catch (error: any) {
    console.error("Gemini roadmap generation error:", error);
    res.status(500).json({ error: "Failed to generate roadmap.", details: error.message });
  }
});

// 4. Resume Analyzer & keyword extraction
app.post('/api/analyze-resume', async (req, res) => {
  const { resumeText, targetRole, skills } = req.body;
  const ai = getGeminiClient();

  const role = targetRole || "Software Engineer";

  if (!ai) {
    return res.json({
      atsScore: 78,
      missingKeywords: ["CI/CD workflows", "Unit Testing Suite", "RESTful Routing optimization", "Database indexes"],
      feedback: [
        "Quantify your accomplishments! Use action-driven verbs and specify exact volume or latency optimizations.",
        "Ensure your contact metadata matches standard recruiting format requirements.",
        "Detail your role in group assignments to establish ownership."
      ],
      grammarSuggestions: [
        "In section 'Experience', change 'responsible for designing REST api' to 'Engineered 12 high-performance security-gated REST API endpoints'."
      ],
      skillSuggestions: ["Redis Caching", "Docker orchestration", "Agile sprint workflows"],
      improvedContent: `Professional Profile:
Detail-oriented and high-performing developer targeting ${role} roles. Demonstrated ability in modular codebase builds, standard database structuring, and algorithmic efficiency.

Key Achievements:
- Engineered complete frontend/backend pathways reducing page loading time by 22%.
- Integrated state trackers managing 1,000+ records safely on SQL backends.
- Solved 150+ DSA algorithmic issues on public competitive platforms.`,
      readinessScore: 82
    });
  }

  try {
    const prompt = `Analyze this student resume text for the target role of "${role}".
    Extant skills listed in profile: "${skills ? skills.join(', ') : 'None'}".
    
    Resume Text To Evaluate:
    "${resumeText || "No text provided. Build feedback addressing standard generic resume layouts."}"
    
    Provide an ATS Critique in JSON format:
    {
      "atsScore": numberFrom0To100,
      "missingKeywords": ["keyword1", "keyword2"],
      "feedback": ["point1", "point2"],
      "grammarSuggestions": ["improvement1"],
      "skillSuggestions": ["skillAdvice1"],
      "improvedContent": "Revised content sample for the professional overview",
      "readinessScore": numberFrom0To100
    }`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            atsScore: { type: Type.INTEGER },
            missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
            grammarSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            skillSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvedContent: { type: Type.STRING },
            readinessScore: { type: Type.INTEGER }
          },
          required: ["atsScore", "missingKeywords", "feedback", "grammarSuggestions", "skillSuggestions", "improvedContent", "readinessScore"]
        }
      }
    });

    res.json(JSON.parse(apiResponse.text || '{}'));
  } catch (error: any) {
    console.error("Resume analyzer error:", error);
    res.status(500).json({ error: "Failed to analyze resume.", details: error.message });
  }
});

// 5. Mock Interview starting questions
app.post('/api/mock-interview/start', async (req, res) => {
  const { role, type, company } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.json({
      questions: [
        `Explain how you would optimize an endpoint under heavy visual/data query loads if you were hired by ${company || "a tech company"}.`,
        "What is the difference between an Abstract Class and an Interface, and when would you use each?",
        "Describe a time when you had to resolve a highly challenging merge conflict or system bug in a group project."
      ]
    });
  }

  try {
    const prompt = `You are an elite interviewer preparing a list of 3 questions for a student.
    Target Role: ${role || "Software Engineer"}
    Interview Type: ${type || "Technical"}
    Target Company to reference if applicable: ${company || "General Tech Firm"}
    
    Return a list of 3 interview questions in JSON:
    {
      "questions": ["question 1", "question 2", "question 3"]
    }`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["questions"]
        }
      }
    });

    res.json(JSON.parse(apiResponse.text || '{}'));
  } catch (error: any) {
    console.error("Mock interview start error:", error);
    res.status(500).json({ error: "Failed to generate interview questions.", details: error.message });
  }
});

// 6. Mock Interview Grading and Feedback
app.post('/api/mock-interview/feedback', async (req, res) => {
  const { history, role, type } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.json({
      overall: "Excellent responses. You demonstrated a robust theoretical understanding, though you could elaborate further on performance numbers or system architectures in structural engineering answers.",
      communicationScore: 88,
      confidenceScore: 85,
      improvementAreas: [
        "Include production metrics: talk about scale (e.g. TPS, query optimization times)",
        "Use the STAR method for behavioral answers (Situation, Task, Action, Result)",
        "Articulate garbage collection features or data structures clearly"
      ]
    });
  }

  try {
    const dialogString = history.map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join("\n");
    const prompt = `Evaluate the following interview transcript where a student is applying for a "${role || "Software Engineer"}" (${type || "Technical"} round).
    
    TRANSCRIPT:
    ${dialogString}
    
    Synthesize details and score the candidate out of 100 on communication, confidence, and overall.
    Return JSON format:
    {
      "overall": "String summary feedback analyzing technical accuracy and tone",
      "communicationScore": number80to100,
      "confidenceScore": number80to100,
      "improvementAreas": ["point1", "point2", "point3"]
    }`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overall: { type: Type.STRING },
            communicationScore: { type: Type.INTEGER },
            confidenceScore: { type: Type.INTEGER },
            improvementAreas: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["overall", "communicationScore", "confidenceScore", "improvementAreas"]
        }
      }
    });

    res.json(JSON.parse(apiResponse.text || '{}'));
  } catch (error: any) {
    console.error("Interview feedback error:", error);
    res.status(500).json({ error: "Failed to process interview feedback.", details: error.message });
  }
});

// 7. AI Mentor chatbot
app.post('/api/mentor/chat', async (req, res) => {
  const { profile, message, history } = req.body;
  const ai = getGeminiClient();

  const userContext = `
  You are an expert AI Career Mentor and Placement Counselor.
  The student you are advising has the following background:
  - Name: ${profile?.name || "Student"}
  - College: ${profile?.college || "Selected College"}
  - Major/Branch: ${profile?.branch || "N/A"}
  - Target Career Goal: ${profile?.targetRole || "Software Engineer"}
  - Current skills list: ${profile?.skills ? profile.skills.join(', ') : 'None'}
  - CGPA: ${profile?.cgpa || "N/A"}
  - Dream Companies: ${profile?.dreamCompanies || "Any Top Tech Firm"}
  
  Provide brief, practical, laser-focused career advice, code optimization snippets if asked, or strategies for placements. Keep response relatively concise.`;

  if (!ai) {
    return res.json({
      reply: `Mentor note: I see you are aiming for ${profile?.targetRole || 'Software Engineer'}! 🌟 Let's strengthen your foundation. Spring Boot and Angular are highly sought-after. Try focusing on setting up sound JWT token verification and understanding transactional database indexing to crack technical interviews!`
    });
  }

  try {
    const formattedHistory = (history || []).map((h: any) => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    // Add context to the first prompt or as a system instruction
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: `${message}` }] }
      ],
      config: {
        systemInstruction: userContext
      }
    });

    res.json({ reply: response.text || "I'm processing your roadmap, how else can I assist?" });
  } catch (error: any) {
    console.error("Mentor chat error:", error);
    res.status(500).json({ error: "Failed to consult Mentor Chatbot.", details: error.message });
  }
});

// 8. GitHub Profile critique
app.post('/api/analyzer/github', async (req, res) => {
  const { username } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.json({
      score: 84,
      critique: `GitHub profile analysis for user \`${username || 'dev'}\`: Outstanding repository structuring! Excellent commit cadence showing continuous activity. Your projects are nicely documented with clean README assets. Consider refactoring duplicate utils across core repositories.`
    });
  }

  try {
    const prompt = `You are a strict code auditor and career advisor. Critique this student's GitHub profile with the username "${username || "student-coder"}". Show high-quality assessment and actionable advice.
    Return JSON format:
    {
      "score": numberScore,
      "critique": "A professional but inspiring critique focusing on READMEs, repositories, languages, and commit frequency."
    }`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            critique: { type: Type.STRING }
          },
          required: ["score", "critique"]
        }
      }
    });

    res.json(JSON.parse(apiResponse.text || '{}'));
  } catch (error: any) {
    console.error("GitHub analyzer error:", error);
    res.json({ score: 75, critique: "Analysis completed. Focus on increasing daily commits and structuring code neatly with explicit README documentation." });
  }
});

// 9. LinkedIn Profile optimization
app.post('/api/analyzer/linkedin', async (req, res) => {
  const { headline, about, role } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.json({
      score: 80,
      optimizedHeadline: `Incoming ${role || 'Software Engineer'} | Active LeetCoder | Java & Angular Full Stack Developer`,
      optimizedAbout: `I am an aspiring ${role || 'Software Engineer'} skilled in building end-to-end applications. Passionate about solving complex algorithms (solved 200+ LeetCode problems) and designing scalable services. Open to career opportunities and collaborative enterprise builds.`,
      suggestions: [
        "Include exact technology names in your headline for search visibility",
        "Add standard call-to-actions in your 'About' section, e.g., 'Let's connect at email@example.com'",
        "Use active verbs to represent individual projects"
      ]
    });
  }

  try {
    const prompt = `Optimize this student's LinkedIn details for a target role of "${role || "Developer"}".
    Headline: "${headline || "Aspiring Engineer"}"
    About Section: "${about || "I am seeking software engineering placements."}"

    Provide optimization results in JSON format:
    {
      "score": numberScoreFrom0To100,
      "optimizedHeadline": "string proposed headline",
      "optimizedAbout": "string proposed about paragraph",
      "suggestions": ["suggestion1", "suggestion2"]
    }`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            optimizedHeadline: { type: Type.STRING },
            optimizedAbout: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["score", "optimizedHeadline", "optimizedAbout", "suggestions"]
        }
      }
    });

    res.json(JSON.parse(apiResponse.text || '{}'));
  } catch (error: any) {
    console.error("LinkedIn optimizer error:", error);
    res.json({
      score: 75,
      optimizedHeadline: `Aspiring ${role || "Engineer"} Specialist`,
      optimizedAbout: "Detail your specific project metrics and professional stack expertise here.",
      suggestions: ["Add high-traffic search keywords matching target placement listings."]
    });
  }
});


// ==========================================
// VITE OR STATIC SERVING MIDDLEWARE
// ==========================================

const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite in middleware mode to compile TypeScript/TSX on the fly
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server launched successfully. Port: ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Server creation error:", err);
});
