"""Offline publication figures with explicit populations, units and missingness."""
from __future__ import annotations
import os
from pathlib import Path
import tempfile
os.environ.setdefault('XDG_CACHE_HOME', str(Path(tempfile.gettempdir()) / 'browserguard-analysis-cache'))
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'browserguard-analysis-mpl'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
import pandas as pd
from data import DIMENSIONS, LEVELS

COLORS = {'Low':'#18EEC1', 'Moderate':'#F6E94D', 'High':'#FF6B7A', 'Unavailable':'#9AAABD', 'Missing':'#FFFFFF'}
HATCH = {'Low':'', 'Moderate':'//', 'High':'xx', 'Unavailable':'..', 'Missing':'++'}
TEXT, DARK = '#19334F', '#0D2D24'
FIGURES = ('assessment_distribution', 'benchmark_reliability', 'tracking_activity',
           'security_headers', 'cdp_comparison', 'benchmark_performance')


def style():
    plt.rcParams.update({'font.family':'DejaVu Sans', 'font.size':11, 'text.color':TEXT,
        'axes.labelcolor':TEXT, 'xtick.color':TEXT, 'ytick.color':TEXT,
        'axes.edgecolor':'#B8C4CE', 'axes.spines.top':False, 'axes.spines.right':False,
        'figure.facecolor':'white', 'axes.facecolor':'white', 'savefig.facecolor':'white',
        'svg.hashsalt':'browserguard-analysis-v1', 'svg.fonttype':'path'})


def frame(title, subtitle, figsize=(13, 8)):
    fig, ax = plt.subplots(figsize=figsize)
    fig.suptitle(title, fontsize=19, fontweight='bold', x=.08, ha='left', y=.97)
    fig.text(.08, .91, subtitle, fontsize=11, color=TEXT)
    fig.subplots_adjust(left=.28, right=.95, top=.84, bottom=.18)
    return fig, ax


def grid(ax, axis='x'):
    ax.set_axisbelow(True)
    ax.grid(axis=axis, color='#E2E8EE', linewidth=.7)


def save(fig, output, name):
    output = Path(output); output.mkdir(parents=True, exist_ok=True)
    fig.savefig(output / f'{name}.png', dpi=300, bbox_inches='tight', metadata={'Software':'BrowserGuard statistical analysis'})
    fig.savefig(output / f'{name}.svg', bbox_inches='tight', metadata={'Date':None, 'Creator':'BrowserGuard statistical analysis'})
    plt.close(fig)


def empty(ax, text):
    ax.axis('off'); ax.text(.5, .5, text, transform=ax.transAxes, ha='center', va='center', wrap=True)


def boxes(ax, groups, categories, metric, *, color='#18EEC1'):
    for pos, cat in enumerate(categories, 1):
        values = pd.to_numeric(groups[groups.category == cat][metric], errors='raise').dropna().astype(float).tolist()
        if not values:
            ax.text(.02, pos, 'No eligible observations', transform=ax.get_yaxis_transform(), va='center', fontsize=9)
            continue
        ax.boxplot([values], positions=[pos], orientation='horizontal', widths=.5, patch_artist=True,
            manage_ticks=False, boxprops={'facecolor':color,'edgecolor':DARK,'linewidth':1},
            medianprops={'color':TEXT,'linewidth':2}, whiskerprops={'color':DARK}, capprops={'color':DARK},
            flierprops={'marker':'o','markerfacecolor':'white','markeredgecolor':TEXT,'markersize':4})
    ax.set_ylim(len(categories)+.7, .3)
    ax.set_xlim(left=-.5 if metric != 'duration_s' else 0)
    grid(ax)


def generate(benchmark, tables, output):
    style(); attempts = benchmark.attempts
    succeeded = attempts[attempts.successful]
    categories = sorted(attempts.category.unique())
    n = len(succeeded)
    fig, ax = frame('Assessment Distribution', f'Successful visits only · n={n} · Unavailable and missing labels remain distinct')
    fig.subplots_adjust(left=.1, right=.95)
    dist = tables['assessment_distribution']; dist = dist[dist.population == 'successful']
    active_levels = [lev for lev in LEVELS if lev != 'Missing' or dist[dist.level == lev]['count'].sum()]
    bottom = [0.] * len(DIMENSIONS)
    small_labels = [[] for _ in DIMENSIONS]
    if n:
        for lev in active_levels:
            counts = [int(dist[(dist.dimension == dim) & (dist.level == lev)]['count'].iloc[0]) for dim in DIMENSIONS]
            heights = [100*c/n for c in counts]
            ax.bar([d.title() for d in DIMENSIONS], heights, bottom=bottom, width=.55,
                color=COLORS[lev], edgecolor=DARK, linewidth=.8, hatch=HATCH[lev], label=lev)
            for i, (height, count) in enumerate(zip(heights, counts)):
                if height >= 6:
                    ax.text(i, bottom[i]+height/2, f'{count}\n{height:.1f}%', ha='center', va='center', color=TEXT, bbox={'facecolor':'white','edgecolor':'none','alpha':.88,'pad':2})
            for i, (height, count) in enumerate(zip(heights, counts)):
                if 0 < height < 6:
                    small_labels[i].append(f'{lev}: {count}')
            bottom = [b+h for b, h in zip(bottom, heights)]
        for i, labels in enumerate(small_labels):
            if labels:
                ax.text(i,102,'\n'.join(labels),ha='center',va='bottom',fontsize=9)
        ax.set_ylim(0, 105+3*max(map(len,small_labels))); ax.set_ylabel('Share of successful visits (%)'); grid(ax, 'y')
        ax.legend(loc='upper center', bbox_to_anchor=(.5,-.1), ncol=len(active_levels), frameon=False)
    else:
        empty(ax, 'No successful visits: no assessment distribution can be estimated.')
    fig.text(.08,.04,'Descriptive category levels; a favorable assessment is not a website safety certificate.',fontsize=10)
    save(fig,output,'assessment_distribution')

    reliability = tables['reliability_by_category']
    fig, ax = frame('Benchmark Reliability', 'All attempts · Outcomes are mutually exclusive; restriction detection uses the existing harness heuristic.', (15,max(8.5,3+len(categories)*.5)))
    positions = list(range(len(reliability))); left = [0.] * len(reliability)
    outcomes = [('successful','Successful','#18EEC1',''),('restricted','Restricted','#F6E94D','//'),
                ('navigation_error','Navigation error','#FF6B7A','xx'),('other_failure','Other failure','#9AAABD','..')]
    for key, label, color, hatch in outcomes:
        widths = [100*r[key]/r['n'] for r in reliability.to_dict('records')]
        ax.barh(positions,widths,left=left,color=color,edgecolor=DARK,linewidth=.7,hatch=hatch,label=label,height=.65)
        left = [a+b for a,b in zip(left,widths)]
    for i, r in enumerate(reliability.to_dict('records')):
        ax.text(102,i,f"{r['success_pct']:.0f}%  |  {r['successful']}/{r['n']}  |  R={r['restricted']}  E={r['navigation_error']}",va='center',fontsize=10)
    ax.set_yticks(positions,[f"{r.category} (n={r.n})" for r in reliability.itertuples()]); ax.invert_yaxis()
    ax.set_xlim(0,155); ax.set_xticks([0,25,50,75,100]); ax.set_xlabel('Share of attempts (%)'); grid(ax)
    ax.legend(loc='upper center',bbox_to_anchor=(.5,-.12),ncol=4,frameon=False)
    fig.text(.08,.04,'R = restrictions; E = navigation errors. Successful 2xx responses do not establish complete intended-page visibility.',fontsize=10)
    save(fig,output,'benchmark_reliability')

    fig, axes = plt.subplots(1,2,figsize=(15,max(8.5,3+len(categories)*.5)),sharey=True)
    fig.suptitle('Tracking-associated Activity',x=.06,ha='left',fontsize=19,fontweight='bold',y=.98)
    fig.text(.06,.92,f'Successful visits only · n={n} · Domain association does not prove individual-request tracking.',fontsize=11)
    fig.subplots_adjust(left=.28,right=.97,top=.82,bottom=.18,wspace=.28)
    for ax, metric, label, color in zip(axes, ['tracker_domains','tracker_requests'],['Tracking-associated domains (count)','Tracking-associated requests (count)'],['#18EEC1','#97C8E2']):
        boxes(ax,succeeded,categories,metric,color=color); ax.set_xlabel(label)
        total_missing = int(succeeded[metric].isna().sum())
        ax.set_title(f'Available n={n-total_missing}; missing={total_missing}',fontsize=11,pad=12)
    sample_labels=[]
    for category in categories:
        g=succeeded[succeeded.category==category]
        nd,nr=int(g.tracker_domains.notna().sum()),int(g.tracker_requests.notna().sum())
        sample_labels.append(f'{category} (n={nd})' if nd==nr else f'{category} (n={nd}/{nr})')
    axes[0].set_yticks(range(1,len(categories)+1),sample_labels)
    fig.text(.06,.05,'Box: Q1–Q3; line: median; whiskers: 1.5×IQR; circles: statistical outliers, not bug labels. n = available observations per category (domains/requests when different).',fontsize=10)
    save(fig,output,'tracking_activity')

    headers = tables['header_presence']; headers = headers[headers.population == 'successful']
    fig, ax = frame('Security Headers', f'Successful visits · population n={n} · Presence percentage uses comparable responses only.',(14,7.5))
    fig.subplots_adjust(bottom=.27)
    left = [0] * len(headers)
    for key, label, color, hatch in [('present','Present','#18EEC1',''),('absent','Absent','#F6E94D','//'),('not_evaluable','Not evaluable','#B3C1CF','..')]:
        widths = headers[key].tolist(); ax.barh(range(len(headers)),widths,left=left,color=color,edgecolor=DARK,hatch=hatch,label=label,height=.6)
        for i,width in enumerate(widths):
            if width >= max(n,1)*.07:
                ax.text(left[i]+width/2,i,str(width),ha='center',va='center',fontsize=10,bbox={'facecolor':'white','edgecolor':'none','alpha':.88,'pad':2})
        left = [a+b for a,b in zip(left,widths)]
    for i,r in enumerate(headers.itertuples()):
        pct='—' if pd.isna(r.presence_pct_valid) else f'{r.presence_pct_valid:.1f}%'
        ax.text(max(n,1)*1.03,i,f'{pct} present | valid n={r.valid_denominator}; NA={r.not_evaluable}',va='center',fontsize=10)
    ax.set_yticks(range(len(headers)),headers.header);ax.invert_yaxis();ax.set_xlim(0,max(n,1)*1.8)
    ax.set_xticks([v for v in ax.get_xticks() if v<=max(n,1)]);ax.set_xlabel('Responses (count)');grid(ax)
    ax.legend(loc='upper center',bbox_to_anchor=(.5,-.15),ncol=3,frameon=False)
    fig.text(.08,.04,'Not evaluable ≠ absent. CSP refers to the enforced response header. Missing hardening headers alone do not establish vulnerabilities.',fontsize=10)
    save(fig,output,'security_headers')

    pairs = benchmark.comparisons
    pairs = pairs[pairs.successful & pairs.request_eligible].copy()
    fig, ax = frame('BrowserGuard vs CDP: Observed Requests', f'Successful visits with identifiable final navigation · n={len(pairs)} · Descriptive paired counts, not matched observation windows.')
    fig.subplots_adjust(left=.12,right=.95)
    if len(pairs):
        ax.scatter(pairs.cdp_requests,pairs.extension_requests,color='#18EEC1',edgecolors=DARK,alpha=.7,s=45,label='Observed pairs')
        limit=max(float(pairs.cdp_requests.max()),float(pairs.extension_requests.max()),1)*1.08
        ax.plot([0,limit],[0,limit],color=TEXT,linestyle='--',linewidth=1.2,label='y = x (reference only)')
        pairs['absolute_delta']=(pairs.extension_requests-pairs.cdp_requests).abs()
        if pairs.absolute_delta.max()>0:
            largest=pairs.sort_values(['absolute_delta','id'],ascending=[False,True]).head(3)
            ax.scatter(largest.cdp_requests,largest.extension_requests,marker='D',s=100,facecolors='none',edgecolors='#225F9A',linewidths=1.6,label=f'Largest {len(largest)} |Δ| (rank, not risk threshold)')
        ax.set_xlim(0,limit);ax.set_ylim(0,limit);ax.legend(loc='upper left',frameon=False,fontsize=10)
        ax.set_xlabel('CDP observed requests (count)');ax.set_ylabel('BrowserGuard observed requests (count)');grid(ax,'both')
    else:
        empty(ax,'No eligible paired request observations.\nA quantitative comparison would be misleading.')
    fig.text(.08,.04,'Differences may reflect collection timing, redirects, cache, workers, iframes, and process visibility. No bug threshold is applied.',fontsize=10)
    save(fig,output,'cdp_comparison')

    fig, ax = frame('Benchmark Performance', f'All attempts · n={len(attempts)} · Attempt duration includes navigation, observation and popup extraction.',(14,max(8.5,3+len(categories)*.5)))
    fig.subplots_adjust(right=.82)
    boxes(ax,attempts,categories,'duration_s')
    labels=[]
    for i,category in enumerate(categories,1):
        values=attempts[attempts.category==category].duration_s.dropna().astype(float)
        labels.append(f'{category} (n={len(values)})')
        if len(values):ax.text(1.02,i,f'median {values.median():.2f} s',transform=ax.get_yaxis_transform(),va='center',fontsize=10)
    ax.set_yticks(range(1,len(categories)+1),labels);ax.set_xlabel('Full attempt duration (seconds)')
    fig.text(.08,.04,'Boxes: Q1–Q3; whiskers: 1.5×IQR; circles: statistical outliers. Inter-site delays and total run time are separate; this is not extension-only latency.',fontsize=10)
    save(fig,output,'benchmark_performance')
