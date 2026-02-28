# 🔥 Complete Firebase Migration Script
# This script migrates all remaining SQLite calls to Firestore

Write-Host "🚀 Starting complete Firebase migration..." -ForegroundColor Cyan
Write-Host ""

# Define replacements
$replacements = @(
    # Practice Aptitude - GET
    @{
        Old = "const db = getDb();`n                    const results = db.prepare('SELECT * FROM practice_aptitude WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(session.userId);`n                    return sendJson(res, 200, { results });"
        New = "const results = await practiceAptitudeService.getByUser(session.userId, 50);`n                    return sendJson(res, 200, { results });"
    },
    
    # Practice Aptitude - POST
    @{
        Old = "const db = getDb();`n                        db.prepare(``INSERT INTO practice_aptitude (id, user_id, score, total_questions, correct_answers, category_performance, weak_topics, recommendations, completed_at)`n              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)``)`n                            .run(id, session.userId, body.score, body.totalQuestions, body.correctAnswers,`n                                JSON.stringify(body.categoryPerformance || {}), JSON.stringify(body.weakTopics || []),`n                                JSON.stringify(body.recommendations || []), body.completedAt || new Date().toISOString());"
        New = "await practiceAptitudeService.create({`n                            id,`n                            user_id: session.userId,`n                            score: body.score,`n                            total_questions: body.totalQuestions,`n                            correct_answers: body.correctAnswers,`n                            category_performance: JSON.stringify(body.categoryPerformance || {}),`n                            weak_topics: JSON.stringify(body.weakTopics || []),`n                            recommendations: JSON.stringify(body.recommendations || []),`n                            completed_at: body.completedAt || new Date().toISOString()`n                        });"
    }
)

Write-Host "✅ Migration patterns defined" -ForegroundColor Green
Write-Host "📝 Manual migration required for complex endpoints" -ForegroundColor Yellow
Write-Host ""
Write-Host "Due to the complexity of the remaining endpoints, continuing with manual targeted updates..."
