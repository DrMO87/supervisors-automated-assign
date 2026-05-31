-- Create swap_requests table
CREATE TABLE IF NOT EXISTS public.swap_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_date DATE NOT NULL,
    period INTEGER NOT NULL,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    original_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    replacement_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Policies for swap_requests
-- Anyone authenticated can insert
CREATE POLICY "Authenticated users can insert swap requests"
    ON public.swap_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Anyone authenticated can view their own requests, or all requests if admin. 
-- For simplicity, since the app relies mostly on single generic accounts and admin reads all:
CREATE POLICY "Authenticated users can read swap requests"
    ON public.swap_requests
    FOR SELECT
    TO authenticated
    USING (true);

-- Only authenticated users can update (admin)
CREATE POLICY "Authenticated users can update swap requests"
    ON public.swap_requests
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Add to publications for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.swap_requests;
