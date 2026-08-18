export namespace main {
	
	export class MilestonesView {
	    first_sprout_at?: string;
	    first_tree_at?: string;
	    ten_notes_at?: string;
	    twenty_notes_at?: string;
	
	    static createFrom(source: any = {}) {
	        return new MilestonesView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.first_sprout_at = source["first_sprout_at"];
	        this.first_tree_at = source["first_tree_at"];
	        this.ten_notes_at = source["ten_notes_at"];
	        this.twenty_notes_at = source["twenty_notes_at"];
	    }
	}
	export class NoteView {
	    id: string;
	    title: string;
	    body: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    last_visited: any;
	    visit_count: number;
	    // Go type: time
	    last_manual_water: any;
	    world_x: number;
	    world_y: number;
	    positioned: boolean;
	    stage: string;
	    species: string;
	
	    static createFrom(source: any = {}) {
	        return new NoteView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.body = source["body"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.last_visited = this.convertValues(source["last_visited"], null);
	        this.visit_count = source["visit_count"];
	        this.last_manual_water = this.convertValues(source["last_manual_water"], null);
	        this.world_x = source["world_x"];
	        this.world_y = source["world_y"];
	        this.positioned = source["positioned"];
	        this.stage = source["stage"];
	        this.species = source["species"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaletteView {
	    primary: string;
	    secondary: string;
	    accent: string;
	    muted: string;
	    heading: string;
	    list: string;
	
	    static createFrom(source: any = {}) {
	        return new PaletteView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.primary = source["primary"];
	        this.secondary = source["secondary"];
	        this.accent = source["accent"];
	        this.muted = source["muted"];
	        this.heading = source["heading"];
	        this.list = source["list"];
	    }
	}
	export class StatsView {
	    total_notes: number;
	    stage_counts: Record<string, number>;
	    current_streak: number;
	    longest_streak: number;
	    last_active_date: string;
	    milestones: MilestonesView;
	    daily_counts: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new StatsView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_notes = source["total_notes"];
	        this.stage_counts = source["stage_counts"];
	        this.current_streak = source["current_streak"];
	        this.longest_streak = source["longest_streak"];
	        this.last_active_date = source["last_active_date"];
	        this.milestones = this.convertValues(source["milestones"], MilestonesView);
	        this.daily_counts = source["daily_counts"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TrailView {
	    note_a: string;
	    note_b: string;
	    dimmed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TrailView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.note_a = source["note_a"];
	        this.note_b = source["note_b"];
	        this.dimmed = source["dimmed"];
	    }
	}

}

export namespace store {
	
	export class WorkspaceState {
	    open_ids: string[];
	    active_id: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.open_ids = source["open_ids"];
	        this.active_id = source["active_id"];
	    }
	}

}

