import * as fs from 'fs';
import * as path from 'path';

export interface SpringProjectInfo {
  detected: boolean;
  label: string;
}

export async function detectSpringProject(workspaceRoot: string): Promise<SpringProjectInfo> {
  const pomPath = path.join(workspaceRoot, 'pom.xml');
  if (fs.existsSync(pomPath)) {
    const content = fs.readFileSync(pomPath, 'utf-8');
    if (/spring-boot-starter-web/.test(content)) {
      return { detected: true, label: 'Spring Boot' };
    }
  }

  const gradleFiles = ['build.gradle', 'build.gradle.kts'];
  for (const file of gradleFiles) {
    const gradlePath = path.join(workspaceRoot, file);
    if (fs.existsSync(gradlePath)) {
      const content = fs.readFileSync(gradlePath, 'utf-8');
      if (/spring-boot-starter-web|org\.springframework\.boot/.test(content)) {
        return { detected: true, label: 'Spring Boot' };
      }
    }
  }

  return { detected: false, label: '' };
}
