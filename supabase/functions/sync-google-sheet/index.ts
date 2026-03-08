import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

function findHeader(headers: string[], search: string): string | undefined {
  return headers.find(h => h.toLowerCase().includes(search.toLowerCase()));
}

function getField(row: Record<string, string>, search: string): string {
  const headers = Object.keys(row);
  const key = findHeader(headers, search);
  return key ? (row[key] || '').trim() : '';
}

function parsePrograms(val: string): string[] {
  return val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetUrl } = await req.json();
    
    if (!sheetUrl) {
      return new Response(JSON.stringify({ error: 'sheetUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert Google Sheets URL to CSV export URL
    // Supports: https://docs.google.com/spreadsheets/d/SHEET_ID/...
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) {
      return new Response(JSON.stringify({ error: 'Invalid Google Sheets URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    console.log('Fetching CSV from:', csvUrl);
    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch sheet. Make sure it is publicly accessible (Anyone with the link can view).' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const csvText = await csvResponse.text();
    const rows = parseCSV(csvText);
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No data found in sheet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Parsed ${rows.length} rows from sheet`);

    // Map rows to intern records
    const interns = rows.map(row => {
      const firstName = getField(row, 'First Name');
      const lastName = getField(row, 'Last Name');
      if (!firstName && !lastName) return null;

      return {
        first_name: firstName,
        last_name: lastName,
        email_submission: getField(row, 'Email Address') || Object.values(row)[1] || '',
        student_email: getField(row, "student's email") || getField(row, 'This should be the student'),
        phone: getField(row, 'What is your phone number'),
        parent_phone: getField(row, "parent/guardian's phone"),
        dob: getField(row, 'Date of Birth'),
        school: getField(row, 'Which CMSD school'),
        other_school: getField(row, 'If you do not attend a CMSD'),
        grade: getField(row, 'What grade are you currently'),
        programs: parsePrograms(getField(row, 'Have you participated in any of the following')),
        it_interests: parsePrograms(getField(row, 'What areas of IT Interest')),
        cleveland_clinic: getField(row, 'Cleveland Clinic'),
        construction_mgmt: getField(row, 'Construction Management'),
        biomedical: getField(row, 'Biomedical Science'),
        env_justice: getField(row, 'Environmental Justice'),
        env_climate: getField(row, 'Climate Adaptation'),
        env_field_science: getField(row, 'Field Science'),
        iers_center: getField(row, 'IERS Center'),
        magnet_manufacturing: getField(row, 'MAGNET'),
        education_internship: getField(row, 'education-oriented'),
        healthcare: getField(row, 'healthcare-related'),
        video_games: getField(row, 'designing video games'),
        cs_course_taken: getField(row, 'Computer Science or IT course'),
        specific_interests: getField(row, "specific interests that weren't"),
        additional_questions: getField(row, 'additional questions'),
        timestamp: getField(row, 'Timestamp'),
        source_sheet_url: sheetUrl,
      };
    }).filter(Boolean);

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Clear existing interns from this sheet and re-insert
    await supabase.from('interns').delete().eq('source_sheet_url', sheetUrl);

    // Insert all interns
    const { error: insertError } = await supabase.from('interns').insert(interns);
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to insert interns', details: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark duplicates: group by first_name + last_name, keep newest
    const { data: allInterns } = await supabase.from('interns').select('id, first_name, last_name, timestamp');
    if (allInterns) {
      const groups = new Map<string, typeof allInterns>();
      for (const intern of allInterns) {
        const key = `${intern.first_name.toLowerCase()}_${intern.last_name.toLowerCase()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(intern);
      }

      for (const [, group] of groups) {
        if (group.length <= 1) continue;
        
        // Sort by timestamp descending
        group.sort((a, b) => {
          const da = new Date(a.timestamp || '').getTime() || 0;
          const db = new Date(b.timestamp || '').getTime() || 0;
          return db - da;
        });

        // Mark all as duplicates
        const allIds = group.map(g => g.id);
        await supabase.from('interns').update({ is_duplicate: true, is_newest: false }).in('id', allIds);
        // Mark newest
        await supabase.from('interns').update({ is_newest: true }).eq('id', group[0].id);
      }
    }

    // Update sync config
    await supabase.from('sync_config').upsert({
      sheet_url: sheetUrl,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'sheet_url' });

    return new Response(JSON.stringify({ 
      success: true, 
      count: interns.length,
      message: `Synced ${interns.length} interns from Google Sheet`
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
