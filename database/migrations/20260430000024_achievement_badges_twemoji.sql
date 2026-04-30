-- Temporary badges (Twemoji) for Phase-1 achievements
-- You can replace badge_icon_url later with custom design URLs.

UPDATE achievement_definitions
SET badge_icon_url = CASE key
  -- Driving
  WHEN 'driving_first_drive' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f697.png' -- car
  WHEN 'driving_50km' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f6e3.png' -- motorway
  WHEN 'driving_250km' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f9ed.png' -- compass
  WHEN 'driving_1000km' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f5fa.png' -- world map
  WHEN 'driving_5000km' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f680.png' -- rocket
  WHEN 'driving_50000km' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f451.png' -- crown

  -- Convoy
  WHEN 'convoy_member' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f46a.png' -- family/group
  WHEN 'convoy_team_player' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f91d.png' -- handshake
  WHEN 'convoy_veteran' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f3c5.png' -- medal

  -- Convoy Leader
  WHEN 'leader_first' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/2b50.png' -- star
  WHEN 'leader_organizer_5' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f4cb.png' -- clipboard
  WHEN 'leader_commander_10' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f4e3.png' -- megaphone
  WHEN 'leader_captain_25' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/2693.png' -- anchor
  WHEN 'leader_elite_50' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f48e.png' -- gem
  WHEN 'leader_master_100' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f3c6.png' -- trophy
  WHEN 'leader_legend_250' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f409.png' -- dragon
  WHEN 'leader_king_500' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f451.png' -- crown

  -- Garage
  WHEN 'garage_owner' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f699.png' -- SUV
  WHEN 'garage_collector_3' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f4e6.png' -- package
  WHEN 'garage_master_5' THEN 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f6e0.png' -- hammer and wrench

  ELSE badge_icon_url
END
WHERE key IN (
  'driving_first_drive','driving_50km','driving_250km','driving_1000km','driving_5000km','driving_50000km',
  'convoy_member','convoy_team_player','convoy_veteran',
  'leader_first','leader_organizer_5','leader_commander_10','leader_captain_25','leader_elite_50','leader_master_100','leader_legend_250','leader_king_500',
  'garage_owner','garage_collector_3','garage_master_5'
);

