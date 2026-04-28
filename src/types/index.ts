export interface tsSpace {
	id: string;
	name: string;
	location: string;
	total_capacity: number;
	current_count: number;
	amenities: { ac: boolean; wifi: boolean; power: boolean; quiet: boolean };
	status: 'open' | 'closed' | 'maintenance';
}

export interface Checkin {
	id: string;
	user_id: string;
	space_id: string;
	type: 'in' | 'out';
	created_at: string;
}

export interface Report {
	id: string;
	user_id: string;
	space_id: string;
	issue_type: string;
	description: string;
	photo_url?: string;
	created_at: string;
}

export interface Profile {
	id: string;
	full_name: string;
	matric_no: string;
	faculty: string;
	avatar_url?: string;
}
