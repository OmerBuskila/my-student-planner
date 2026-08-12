היומן שלי - חבילת Cloudflare Pages

העלאה:
1. Workers & Pages
2. Create application
3. ליד Looking to deploy Pages לחץ Get started
4. בחר Drag and drop your files
5. גרור את התיקייה student_planner_cloudflare או את כל הקבצים שבתוכה
6. תן שם לפרויקט
7. Deploy site

הקבצים:
index.html
style.css
script.js
manifest.json
sw.js
icons/

חשוב:
כרגע הנתונים עדיין נשמרים ב-localStorage, כמו בגרסה הקודמת.
כלומר האתר יעבוד בכל מכשיר, אבל הנתונים עדיין לא יסתנכרנו ביניהם.
השלב הבא הוא חיבור Cloudflare D1/Worker לסנכרון ענן.
