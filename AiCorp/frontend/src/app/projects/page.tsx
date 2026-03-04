"use client";

import { useEffect, useState, useCallback } from "react";
import { Project } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { FolderKanban, Github, Globe, Code2 } from "lucide-react";

const stageColors: Record<string, string> = {
  idea: "bg-surface-700/50 text-surface-300",
  mvp: "bg-amber-500/10 text-amber-400",
  beta: "bg-blue-500/10 text-blue-400",
  launched: "bg-green-500/10 text-green-400",
  scaling: "bg-purple-500/10 text-purple-400",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-accent-light" />
            Portfolio Projects
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Companies and projects your agents are monitoring
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-surface-500">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-8 text-center">
          <FolderKanban className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <h3 className="text-surface-300 font-medium mb-1">
            No projects registered yet
          </h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto">
            Add your companies and coding projects via the API so your agents
            can start monitoring them. Use POST /api/projects with your project
            details.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const stageStyle = stageColors[project.stage] ?? stageColors.idea;

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 hover:border-surface-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-surface-100">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageStyle}`}>
              {project.stage}
            </span>
            <span className="text-[10px] bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded">
              {project.category}
            </span>
            <StatusBadge status={project.status} />
          </div>
        </div>
      </div>

      {project.description && (
        <p className="text-xs text-surface-400 line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      {/* Links */}
      <div className="flex items-center gap-3 mb-3">
        {project.github_repos.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-surface-400">
            <Github className="w-3 h-3" />
            {project.github_repos.length} repo{project.github_repos.length > 1 ? "s" : ""}
          </div>
        )}
        {project.website_url && (
          <a
            href={project.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent-light hover:text-accent"
          >
            <Globe className="w-3 h-3" />
            Website
          </a>
        )}
      </div>

      {/* Tech stack */}
      {project.tech_stack.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          <Code2 className="w-3 h-3 text-surface-500 mr-1" />
          {project.tech_stack.map((tech, i) => (
            <span
              key={i}
              className="text-[10px] bg-surface-700 text-surface-300 px-1.5 py-0.5 rounded"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* Financials summary */}
      {project.financials && Object.keys(project.financials).length > 0 && (
        <div className="pt-3 border-t border-surface-700/50 grid grid-cols-3 gap-2">
          {project.financials.runway_months !== undefined && (
            <div>
              <p className="text-sm font-semibold text-surface-200">
                {String(project.financials.runway_months)}mo
              </p>
              <p className="text-[9px] text-surface-500 uppercase">Runway</p>
            </div>
          )}
          {project.financials.mrr !== undefined && (
            <div>
              <p className="text-sm font-semibold text-surface-200">
                ${String(project.financials.mrr)}
              </p>
              <p className="text-[9px] text-surface-500 uppercase">MRR</p>
            </div>
          )}
          {project.financials.burn_rate !== undefined && (
            <div>
              <p className="text-sm font-semibold text-surface-200">
                ${String(project.financials.burn_rate)}
              </p>
              <p className="text-[9px] text-surface-500 uppercase">Burn/mo</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
