import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hekjqxorqctgolqqexsz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhla2pxeG9ycWN0Z29scXFleHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDIyMjcsImV4cCI6MjEwNjc3ODIyN30.bEaRJHz87EMqqIYUodJn9Gv3br1Y5AYFTG9ZjjKVCZo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
