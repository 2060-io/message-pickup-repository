ALTER TABLE queued_message
ADD COLUMN IF NOT EXISTS encrypted_message_byte_count INTEGER;