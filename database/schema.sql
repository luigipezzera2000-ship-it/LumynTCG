CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE sets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, game TEXT NOT NULL, release_date DATE);
CREATE TABLE cards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), set_id UUID NOT NULL REFERENCES sets(id), name TEXT NOT NULL, number TEXT NOT NULL, rarity TEXT, image_url TEXT, UNIQUE(set_id, number));
CREATE TABLE variants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE, name TEXT NOT NULL, finish TEXT);
CREATE TABLE collections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL DEFAULT 'My collection', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE user_cards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE, card_id UUID NOT NULL REFERENCES cards(id), variant_id UUID REFERENCES variants(id), quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0), condition TEXT DEFAULT 'NM', acquired_at DATE, purchase_price NUMERIC(12,2), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE prices (id BIGSERIAL PRIMARY KEY, card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE, source TEXT NOT NULL, price NUMERIC(12,2) NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX prices_card_date_idx ON prices(card_id, captured_at DESC);
