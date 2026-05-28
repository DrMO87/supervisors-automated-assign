'use client';

import { AlertCircle, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

interface SetupRequiredProps {
  configStatus: {
    configured: boolean;
    urlValid: boolean;
    keyValid: boolean;
    url: string;
  };
}

export function SetupRequired({ configStatus }: SetupRequiredProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Setup Required</h1>
            <p className="text-gray-600">Supabase is not configured properly</p>
          </div>
        </div>

        {/* Status Checks */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Configuration Status:</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {configStatus.urlValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={configStatus.urlValid ? 'text-green-700' : 'text-red-700'}>
                NEXT_PUBLIC_SUPABASE_URL {configStatus.urlValid ? '✓ Valid' : '✗ Invalid or missing'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {configStatus.keyValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={configStatus.keyValid ? 'text-green-700' : 'text-red-700'}>
                NEXT_PUBLIC_SUPABASE_ANON_KEY {configStatus.keyValid ? '✓ Valid' : '✗ Invalid or missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Quick Setup Steps:</h2>
          
          <ol className="list-decimal list-inside space-y-3 text-gray-700">
            <li>
              <span className="font-medium">Create a Supabase project</span>
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:text-blue-800"
              >
                Open Supabase <ExternalLink className="w-4 h-4" />
              </a>
            </li>
            
            <li>
              <span className="font-medium">Get your API keys</span>
              <p className="text-sm text-gray-500 ml-5 mt-1">
                Go to Project Settings → API → Copy the URL and anon key
              </p>
            </li>
            
            <li>
              <span className="font-medium">Update your .env.local file:</span>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg mt-2 text-sm overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...`}
              </pre>
            </li>
            
            <li>
              <span className="font-medium">Run the database migrations</span>
              <p className="text-sm text-gray-500 ml-5 mt-1">
                Go to Supabase SQL Editor and run the SQL files in supabase/migrations/
              </p>
            </li>
            
            <li>
              <span className="font-medium">Restart the development server</span>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg mt-2 text-sm">
                npm run dev
              </pre>
            </li>
          </ol>
        </div>

        {/* Help Links */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Check these files in your project:
          </p>
          <ul className="mt-2 text-sm text-gray-600 space-y-1">
            <li>📄 <code className="bg-gray-100 px-1 rounded">COMPLETE_SETUP_GUIDE.md</code></li>
            <li>📄 <code className="bg-gray-100 px-1 rounded">WHERE_TO_FIND_KEYS.md</code></li>
            <li>🔧 <code className="bg-gray-100 px-1 rounded">setup-supabase.bat</code> (Windows automated setup)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

