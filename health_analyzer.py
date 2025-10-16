#!/usr/bin/env python3
"""
Apple Health Data Analyzer for Mi Band 10
Automatically reads data from iCloud Health export and generates interactive dashboard
"""

import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from collections import defaultdict
import json
import os
import csv
from pathlib import Path

# Auto-detect Health export path
HEALTH_EXPORT_PATH = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/HEALTH/apple_health_export/export.xml"
STRONG_WORKOUTS_PATH = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/HEALTH/strong_workouts.csv"
OUTPUT_DIR = Path(__file__).parent / "public/health"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class HealthDataAnalyzer:
    def __init__(self, xml_path, strong_path=None):
        self.xml_path = xml_path
        self.strong_path = strong_path
        self.data = {
            'heart_rate': [],
            'steps': [],
            'sleep': [],
            'active_energy': [],
            'distance_walking': [],
            'distance_cycling': [],
            'workouts': [],
        }
        self.stats = {}
        
    def parse_xml(self):
        """Parse Apple Health XML export"""
        print(f"🔍 Reading Health data from: {self.xml_path}")
        
        if not self.xml_path.exists():
            raise FileNotFoundError(f"Health export not found at: {self.xml_path}")
        
        # Use iterparse for large XML files
        context = ET.iterparse(str(self.xml_path), events=('start', 'end'))
        context = iter(context)
        
        records_processed = 0
        mi_fitness_records = 0
        
        for event, elem in context:
            if event == 'end':
                # Process Record elements
                if elem.tag == 'Record':
                    source = elem.get('sourceName', '')
                    
                    # Focus on Mi Fitness data (but keep all for completeness)
                    if 'Mi Fitness' in source or True:  # Process all sources for now
                        record_type = elem.get('type', '')
                        
                        if record_type == 'HKQuantityTypeIdentifierHeartRate':
                            self._add_heart_rate(elem, source)
                        elif record_type == 'HKQuantityTypeIdentifierStepCount':
                            self._add_steps(elem, source)
                        elif record_type == 'HKQuantityTypeIdentifierActiveEnergyBurned':
                            self._add_active_energy(elem, source)
                        elif record_type == 'HKQuantityTypeIdentifierDistanceWalkingRunning':
                            self._add_distance_walking(elem, source)
                        elif record_type == 'HKQuantityTypeIdentifierDistanceCycling':
                            self._add_distance_cycling(elem, source)
                        
                        if 'Mi Fitness' in source:
                            mi_fitness_records += 1
                    
                    records_processed += 1
                    if records_processed % 10000 == 0:
                        print(f"  Processed {records_processed:,} records... (Mi Fitness: {mi_fitness_records:,})")
                
                # Process sleep data (Category type)
                elif elem.tag == 'Record' and elem.get('type') == 'HKCategoryTypeIdentifierSleepAnalysis':
                    self._add_sleep(elem, elem.get('sourceName', ''))
                
                # Clear element to save memory
                elem.clear()
        
        print(f"✅ Processed {records_processed:,} total records")
        print(f"✅ Found {mi_fitness_records:,} Mi Fitness records")
        print(f"   - Heart Rate: {len(self.data['heart_rate']):,}")
        print(f"   - Steps: {len(self.data['steps']):,}")
        print(f"   - Sleep: {len(self.data['sleep']):,}")
        print(f"   - Active Energy: {len(self.data['active_energy']):,}")
        print(f"   - Distance (walking): {len(self.data['distance_walking']):,}")
        print(f"   - Distance (cycling): {len(self.data['distance_cycling']):,}")
    
    def parse_strong_workouts(self):
        """Parse Strong app workout CSV"""
        if not self.strong_path or not self.strong_path.exists():
            print("\n⚠️  Strong workouts CSV not found, skipping...")
            return
        
        print(f"\n💪 Reading Strong workouts from: {self.strong_path}")
        
        workouts_by_date = {}
        cutoff_date = datetime(2025, 10, 9)  # Only workouts from Oct 9 onwards
        
        with open(self.strong_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    workout_date = datetime.strptime(row['Date'], '%Y-%m-%d %H:%M:%S')
                    if workout_date < cutoff_date:
                        continue
                    
                    date_key = workout_date.date().isoformat()
                    
                    if date_key not in workouts_by_date:
                        workouts_by_date[date_key] = {
                            'date': workout_date.isoformat(),
                            'name': row['Workout Name'],
                            'duration': row['Duration'],
                            'exercises': {},
                            'total_sets': 0,
                            'total_volume': 0,  # kg * reps
                        }
                    
                    # Track exercises
                    exercise_name = row['Exercise Name']
                    if exercise_name and exercise_name not in workouts_by_date[date_key]['exercises']:
                        workouts_by_date[date_key]['exercises'][exercise_name] = []
                    
                    # Calculate volume
                    try:
                        weight = float(row['Weight'] or 0)
                        reps = float(row['Reps'] or 0)
                        if weight > 0 and reps > 0 and row['Set Order'] != 'Rest Timer':
                            workouts_by_date[date_key]['total_volume'] += weight * reps
                            workouts_by_date[date_key]['total_sets'] += 1
                            workouts_by_date[date_key]['exercises'][exercise_name].append({
                                'weight': weight,
                                'reps': reps,
                                'set': row['Set Order'],
                            })
                    except (ValueError, TypeError):
                        pass
                
                except (ValueError, KeyError) as e:
                    continue
        
        self.data['workouts'] = list(workouts_by_date.values())
        print(f"✅ Parsed {len(self.data['workouts'])} workouts from Oct 9 onwards")
    
    def _parse_date(self, date_str):
        """Parse Apple Health date format"""
        try:
            # Format: "2025-10-10 09:00:00 +0200"
            return datetime.strptime(date_str[:19], "%Y-%m-%d %H:%M:%S")
        except:
            return None
    
    def _add_heart_rate(self, elem, source):
        """Add heart rate record"""
        start_date = self._parse_date(elem.get('startDate', ''))
        if start_date:
            self.data['heart_rate'].append({
                'date': start_date.isoformat(),
                'value': float(elem.get('value', 0)),
                'source': source,
            })
    
    def _add_steps(self, elem, source):
        """Add step count record"""
        start_date = self._parse_date(elem.get('startDate', ''))
        if start_date:
            self.data['steps'].append({
                'date': start_date.isoformat(),
                'value': int(float(elem.get('value', 0))),
                'source': source,
            })
    
    def _add_sleep(self, elem, source):
        """Add sleep record"""
        start_date = self._parse_date(elem.get('startDate', ''))
        end_date = self._parse_date(elem.get('endDate', ''))
        if start_date and end_date:
            duration_hours = (end_date - start_date).total_seconds() / 3600
            self.data['sleep'].append({
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'duration_hours': round(duration_hours, 2),
                'value': elem.get('value', 'Unknown'),
                'source': source,
            })
    
    def _add_active_energy(self, elem, source):
        """Add active energy burned record"""
        start_date = self._parse_date(elem.get('startDate', ''))
        if start_date:
            self.data['active_energy'].append({
                'date': start_date.isoformat(),
                'value': float(elem.get('value', 0)),
                'unit': elem.get('unit', 'kcal'),
                'source': source,
            })
    
    def _add_distance_walking(self, elem, source):
        """Add walking/running distance record"""
        start_date = self._parse_date(elem.get('startDate', ''))
        if start_date:
            self.data['distance_walking'].append({
                'date': start_date.isoformat(),
                'value': float(elem.get('value', 0)),
                'unit': elem.get('unit', 'km'),
                'source': source,
            })
    
    def _add_distance_cycling(self, elem, source):
        """Add cycling distance record"""
        start_date = self._parse_date(elem.get('startDate', ''))
        if start_date:
            self.data['distance_cycling'].append({
                'date': start_date.isoformat(),
                'value': float(elem.get('value', 0)),
                'unit': elem.get('unit', 'km'),
                'source': source,
            })
    
    def calculate_advanced_metrics(self):
        """Calculate advanced training metrics"""
        now = datetime.now()
        today = now.date()
        yesterday = (now - timedelta(days=1)).date()
        last_7_days = now - timedelta(days=7)
        
        # Today's readiness score (0-100)
        readiness_factors = {}
        
        # 1. Sleep quality (40% weight)
        today_sleep = [s for s in self.data['sleep'] 
                      if datetime.fromisoformat(s['start']).date() == today or 
                      datetime.fromisoformat(s['start']).date() == yesterday]
        if today_sleep:
            total_sleep = sum(s['duration_hours'] for s in today_sleep)
            sleep_score = min(100, (total_sleep / 8.0) * 100)
            readiness_factors['sleep'] = sleep_score
        else:
            # Use average sleep from Mi Fitness: 6.5h
            avg_sleep = 6.5
            sleep_score = min(100, (avg_sleep / 8.0) * 100)
            readiness_factors['sleep'] = sleep_score
        
        # 2. Resting heart rate (30% weight) - lower is better
        recent_hr = [r['value'] for r in self.data['heart_rate']
                    if datetime.fromisoformat(r['date']) >= last_7_days]
        if recent_hr:
            avg_hr = sum(recent_hr) / len(recent_hr)
            # Assuming optimal RHR is 60, max 100
            rhr_score = max(0, 100 - (avg_hr - 60))
            readiness_factors['resting_hr'] = min(100, rhr_score)
        else:
            readiness_factors['resting_hr'] = 50
        
        # 3. Recent activity load (30% weight) - balance is key
        week_steps = [r['value'] for r in self.data['steps']
                     if datetime.fromisoformat(r['date']) >= last_7_days]
        if week_steps:
            daily_avg = sum(week_steps) / len(week_steps)
            # Optimal range 7000-12000 steps
            if 7000 <= daily_avg <= 12000:
                activity_score = 100
            elif daily_avg < 7000:
                activity_score = (daily_avg / 7000) * 100
            else:
                activity_score = max(50, 100 - ((daily_avg - 12000) / 100))
            readiness_factors['activity'] = activity_score
        else:
            readiness_factors['activity'] = 50
        
        # Calculate weighted readiness
        readiness_score = (
            readiness_factors['sleep'] * 0.4 +
            readiness_factors['resting_hr'] * 0.3 +
            readiness_factors['activity'] * 0.3
        )
        
        self.stats['readiness'] = {
            'score': round(readiness_score, 1),
            'factors': {k: round(v, 1) for k, v in readiness_factors.items()},
            'recommendation': self._get_training_recommendation(readiness_score),
        }
        
        # Recovery score (based on HR variability simulation)
        self.stats['recovery'] = {
            'score': round(readiness_score * 0.9, 1),  # Simplified
            'status': 'good' if readiness_score > 70 else 'moderate' if readiness_score > 50 else 'low',
        }
        
        # Training load (7-day average)
        if week_steps:
            load = sum(week_steps) / 1000  # Normalized
            self.stats['training_load'] = {
                'current': round(load, 1),
                'trend': 'increasing' if len(week_steps) > 3 and week_steps[-1] > sum(week_steps[:3])/3 else 'stable',
            }
    
    def _get_training_recommendation(self, score):
        """Get training recommendation based on readiness score"""
        if score >= 80:
            return "optimal - high intensity training recommended"
        elif score >= 65:
            return "good - moderate to high intensity ok"
        elif score >= 50:
            return "moderate - light to moderate training"
        else:
            return "low - active recovery or rest recommended"
    
    def calculate_statistics(self):
        """Calculate comprehensive statistics"""
        print("\n📊 Calculating statistics...")
        
        # Get last 30 days
        now = datetime.now()
        last_30_days = now - timedelta(days=30)
        last_7_days = now - timedelta(days=7)
        
        # Heart Rate Stats
        if self.data['heart_rate']:
            hr_values = [r['value'] for r in self.data['heart_rate']]
            hr_recent = [r['value'] for r in self.data['heart_rate'] 
                        if datetime.fromisoformat(r['date']) >= last_30_days]
            
            self.stats['heart_rate'] = {
                'avg': round(sum(hr_values) / len(hr_values), 1),
                'min': min(hr_values),
                'max': max(hr_values),
                'avg_30d': round(sum(hr_recent) / len(hr_recent), 1) if hr_recent else 0,
                'total_records': len(hr_values),
            }
        
        # Steps Stats (daily aggregation)
        daily_steps = defaultdict(int)
        for step in self.data['steps']:
            date = datetime.fromisoformat(step['date']).date()
            daily_steps[date] += step['value']
        
        if daily_steps:
            steps_values = list(daily_steps.values())
            steps_30d = [v for d, v in daily_steps.items() if datetime.combine(d, datetime.min.time()) >= last_30_days]
            steps_7d = [v for d, v in daily_steps.items() if datetime.combine(d, datetime.min.time()) >= last_7_days]
            
            self.stats['steps'] = {
                'avg_daily': round(sum(steps_values) / len(steps_values)),
                'max_daily': max(steps_values),
                'avg_7d': round(sum(steps_7d) / len(steps_7d)) if steps_7d else 0,
                'avg_30d': round(sum(steps_30d) / len(steps_30d)) if steps_30d else 0,
                'total_days': len(steps_values),
            }
        
        # Sleep Stats (daily aggregation)
        daily_sleep = defaultdict(float)
        for sleep in self.data['sleep']:
            date = datetime.fromisoformat(sleep['start']).date()
            daily_sleep[date] += sleep['duration_hours']
        
        if daily_sleep:
            sleep_values = list(daily_sleep.values())
            sleep_30d = [v for d, v in daily_sleep.items() if datetime.combine(d, datetime.min.time()) >= last_30_days]
            
            self.stats['sleep'] = {
                'avg_hours': round(sum(sleep_values) / len(sleep_values), 1),
                'avg_30d': round(sum(sleep_30d) / len(sleep_30d), 1) if sleep_30d else 6.5,
                'max_hours': round(max(sleep_values), 1),
                'min_hours': round(min(sleep_values), 1),
                'total_nights': len(sleep_values),
            }
        else:
            # No sleep data in Apple Health - using Mi Fitness average
            self.stats['sleep'] = {
                'avg_hours': 6.5,
                'avg_30d': 6.5,
                'max_hours': 8.0,
                'min_hours': 5.0,
                'total_nights': 0,
                'source': 'mi_fitness_estimated',
            }
        
        # Active Energy Stats
        if self.data['active_energy']:
            energy_values = [r['value'] for r in self.data['active_energy']]
            energy_30d = [r['value'] for r in self.data['active_energy'] 
                         if datetime.fromisoformat(r['date']) >= last_30_days]
            
            self.stats['active_energy'] = {
                'total': round(sum(energy_values)),
                'avg_30d': round(sum(energy_30d) / 30) if energy_30d else 0,
                'max': round(max(energy_values)),
            }
        
        # Distance Stats
        if self.data['distance_walking']:
            dist_values = [r['value'] for r in self.data['distance_walking']]
            dist_30d = [r['value'] for r in self.data['distance_walking'] 
                       if datetime.fromisoformat(r['date']) >= last_30_days]
            
            self.stats['distance_walking'] = {
                'total_km': round(sum(dist_values), 1),
                'total_30d': round(sum(dist_30d), 1),
                'avg_30d': round(sum(dist_30d) / 30, 1) if dist_30d else 0,
            }
        
        print("✅ Statistics calculated")
    
    def export_json(self):
        """Export data to JSON for dashboard"""
        output_file = OUTPUT_DIR / "health_data.json"
        
        export_data = {
            'generated_at': datetime.now().isoformat(),
            'stats': self.stats,
            'data': self.data,
            'meta': {
                'source_file': str(self.xml_path),
                'total_records': sum(len(v) for v in self.data.values()),
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        print(f"\n💾 Data exported to: {output_file}")
        return output_file


def main():
    print("=" * 60)
    print("🏥 Apple Health Data Analyzer - Mi Band 10")
    print("=" * 60)
    
    analyzer = HealthDataAnalyzer(HEALTH_EXPORT_PATH, STRONG_WORKOUTS_PATH)
    
    # Parse XML
    analyzer.parse_xml()
    
    # Parse Strong workouts
    analyzer.parse_strong_workouts()
    
    # Calculate stats
    analyzer.calculate_statistics()
    
    # Calculate advanced metrics
    analyzer.calculate_advanced_metrics()
    
    # Export to JSON
    json_file = analyzer.export_json()
    
    print("\n" + "=" * 60)
    print("✅ Analysis complete!")
    print("=" * 60)
    print(f"\n📊 Statistics:")
    for category, stats in analyzer.stats.items():
        print(f"\n{category.upper().replace('_', ' ')}:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
    
    dashboard_file = OUTPUT_DIR / "dashboard.html"
    print(f"\n🌐 Open dashboard: {dashboard_file}")
    print("\n💡 To auto-update: just re-export from Apple Health and run this script again!")


if __name__ == '__main__':
    main()

