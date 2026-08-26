export namespace main {
	
	export class EditorPrefsView {
	    font_family: string;
	    font_size: number;
	    line_height: number;
	    spell_check_enabled: boolean;
	    cursor_trail_enabled: boolean;
	    cursor_trail_mode: string;
	    cursor_trail_color: string;
	    cursor_trail_intensity: string;
	    cursor_trail_decay_fast: number;
	    cursor_trail_decay_slow: number;
	    cursor_trail_length: number;
	    cursor_trail_start_threshold: number;
	    animated_text_enabled: boolean;
	    animated_text_style: string;
	
	    static createFrom(source: any = {}) {
	        return new EditorPrefsView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.font_family = source["font_family"];
	        this.font_size = source["font_size"];
	        this.line_height = source["line_height"];
	        this.spell_check_enabled = source["spell_check_enabled"];
	        this.cursor_trail_enabled = source["cursor_trail_enabled"];
	        this.cursor_trail_mode = source["cursor_trail_mode"];
	        this.cursor_trail_color = source["cursor_trail_color"];
	        this.cursor_trail_intensity = source["cursor_trail_intensity"];
	        this.cursor_trail_decay_fast = source["cursor_trail_decay_fast"];
	        this.cursor_trail_decay_slow = source["cursor_trail_decay_slow"];
	        this.cursor_trail_length = source["cursor_trail_length"];
	        this.cursor_trail_start_threshold = source["cursor_trail_start_threshold"];
	        this.animated_text_enabled = source["animated_text_enabled"];
	        this.animated_text_style = source["animated_text_style"];
	    }
	}
	export class KnownSkyView {
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new KnownSkyView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	    }
	}
	export class LayoutPrefsView {
	    sidebar_position: string;
	    density: string;
	    show_status_bar: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LayoutPrefsView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sidebar_position = source["sidebar_position"];
	        this.density = source["density"];
	        this.show_status_bar = source["show_status_bar"];
	    }
	}
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
	    folder: string;
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
	    link_count: number;
	
	    static createFrom(source: any = {}) {
	        return new NoteView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.body = source["body"];
	        this.folder = source["folder"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.last_visited = this.convertValues(source["last_visited"], null);
	        this.visit_count = source["visit_count"];
	        this.last_manual_water = this.convertValues(source["last_manual_water"], null);
	        this.world_x = source["world_x"];
	        this.world_y = source["world_y"];
	        this.positioned = source["positioned"];
	        this.stage = source["stage"];
	        this.species = source["species"];
	        this.link_count = source["link_count"];
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
	    sky: string;
	    nebula: string;
	    aurora: boolean;
	    meteor_boost: number;
	
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
	        this.sky = source["sky"];
	        this.nebula = source["nebula"];
	        this.aurora = source["aurora"];
	        this.meteor_boost = source["meteor_boost"];
	    }
	}
	export class SkyPrefsView {
	    density: string;
	    twinkle_speed: string;
	    star_color: string;
	    nebula_enabled: boolean;
	    species_warm: string;
	    species_cool: string;
	    species_hot: string;
	    species_neutral: string;
	    season: string;
	
	    static createFrom(source: any = {}) {
	        return new SkyPrefsView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.density = source["density"];
	        this.twinkle_speed = source["twinkle_speed"];
	        this.star_color = source["star_color"];
	        this.nebula_enabled = source["nebula_enabled"];
	        this.species_warm = source["species_warm"];
	        this.species_cool = source["species_cool"];
	        this.species_hot = source["species_hot"];
	        this.species_neutral = source["species_neutral"];
	        this.season = source["season"];
	    }
	}
	export class ThemePrefsView {
	    preset: string;
	    accent_hex: string;
	
	    static createFrom(source: any = {}) {
	        return new ThemePrefsView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.preset = source["preset"];
	        this.accent_hex = source["accent_hex"];
	    }
	}
	export class PreferencesView {
	    theme: ThemePrefsView;
	    layout: LayoutPrefsView;
	    editor: EditorPrefsView;
	    sky: SkyPrefsView;
	
	    static createFrom(source: any = {}) {
	        return new PreferencesView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = this.convertValues(source["theme"], ThemePrefsView);
	        this.layout = this.convertValues(source["layout"], LayoutPrefsView);
	        this.editor = this.convertValues(source["editor"], EditorPrefsView);
	        this.sky = this.convertValues(source["sky"], SkyPrefsView);
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
	
	export class SkyStateView {
	    configured: boolean;
	    sky_missing: boolean;
	    sky_name: string;
	    sky_path: string;
	    has_legacy: boolean;
	    registry_empty: boolean;
	    migration_skipped: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SkyStateView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configured = source["configured"];
	        this.sky_missing = source["sky_missing"];
	        this.sky_name = source["sky_name"];
	        this.sky_path = source["sky_path"];
	        this.has_legacy = source["has_legacy"];
	        this.registry_empty = source["registry_empty"];
	        this.migration_skipped = source["migration_skipped"];
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
	
	export class MigrateReport {
	    imported: number;
	    failures?: string[];
	
	    static createFrom(source: any = {}) {
	        return new MigrateReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.imported = source["imported"];
	        this.failures = source["failures"];
	    }
	}
	export class WorkspaceState {
	    open_ids: string[];
	    active_id: string;
	    sky_collapsed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.open_ids = source["open_ids"];
	        this.active_id = source["active_id"];
	        this.sky_collapsed = source["sky_collapsed"];
	    }
	}

}

